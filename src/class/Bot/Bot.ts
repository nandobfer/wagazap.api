import { Prisma } from "@prisma/client"
import { WithoutFunctions } from "../helpers"
import { prisma } from "../../prisma"
import { now } from "lodash"
import { Washima } from "../Washima/Washima"
import { Edge, Node, ReactFlowInstance, ReactFlowJsonObject } from "@xyflow/react"
import Fuse from "fuse.js"

export const bot_include = Prisma.validator<Prisma.BotInclude>()({ washimas: { select: { id: true } }, nagazaps: { select: { id: true } } })
type BotPrisma = Prisma.BotGetPayload<{ include: typeof bot_include }>

export interface FlowNode extends Node {
    data: {
        onAddChild: (type: "message" | "response") => void
        value: string
        editNode: (node: FlowNode | null) => void
        deleteNode?: (node: FlowNode) => void
        getChildren: (parentId: string, type?: "direct" | "recursive") => FlowNode[]
        // nodes: FlowNode[]
        // edges: FlowEdge[]
    }
}

export interface FlowEdge extends Edge {
    type?: string
    animated?: boolean
}
export class ActiveBot {
    chat_id: string
    current_node_id: string
    last_interaction: number
    started_at: number

    constructor(data: WithoutFunctions<ActiveBot>) {
        this.chat_id = data.chat_id
        this.current_node_id = data.current_node_id
        this.last_interaction = data.last_interaction
        this.started_at = data.started_at
    }
}

export type BotForm = Omit<WithoutFunctions<Bot>, "id" | "created_at" | "triggered" | "instance" | "active_on">

export interface PendingResponse {
    response: (text: string) => Promise<void>
    timestamp: number
    chat_id: string
    bot: Bot
}

export class Bot {
    id: string
    name: string
    created_at: string
    trigger: string
    triggered: number
    instance: ReactFlowJsonObject<FlowNode, FlowEdge>
    active_on: ActiveBot[]
    company_id: string
    nagazap_ids: string[]
    washima_ids: string[]
    expiry_minutes: number
    fuzzy_threshold: number

    static pending_response = new Map<string, PendingResponse>()
    static expiry_interval = setInterval(() => Bot.checkForExpiredChats(), 1000 * 10)

    static async new(data: BotForm) {
        const result = await prisma.bot.create({
            data: {
                active_on: JSON.stringify([]),
                created_at: now().toString(),
                instance: JSON.stringify(null),
                name: data.name,
                trigger: data.trigger,
                triggered: 0,
                company_id: data.company_id,
                nagazaps: { connect: data.nagazap_ids.map((id) => ({ id })) },
                washimas: { connect: data.washima_ids.map((id) => ({ id })) },
                expiry_minutes: data.expiry_minutes,
                fuzzy_threshold: data.fuzzy_threshold,
            },
            include: bot_include,
        })

        return new Bot(result)
    }

    static async getById(id: string) {
        const result = await prisma.bot.findUnique({ where: { id }, include: bot_include })
        if (!result) throw "Bot não encontrado"

        return new Bot(result)
    }

    static async getByWashima(washima_id: string) {
        const result = await prisma.bot.findMany({ where: { washimas: { some: { id: washima_id } } }, include: bot_include })
        return result.map((item) => new Bot(item))
    }

    static async getByNagazap(nagazap_id: string) {
        const result = await prisma.bot.findMany({ where: { nagazaps: { some: { id: nagazap_id } } }, include: bot_include })
        return result.map((item) => new Bot(item))
    }

    static async checkForExpiredChats() {
        Bot.pending_response.forEach((item, key) => {
            if (now() >= item.timestamp) {
                item.response("Esta conversa expirou. Quando quiser, comece de novo.")
                item.bot.closeChat(key)
            }
        })
    }

    constructor(data: BotPrisma) {
        this.id = data.id
        this.name = data.name
        this.created_at = data.created_at
        this.trigger = data.trigger
        this.triggered = data.triggered
        this.instance = JSON.parse(data.instance as string)
        this.active_on = JSON.parse(data.active_on as string).map((item: ActiveBot) => new ActiveBot(item))
        this.company_id = data.company_id
        this.washima_ids = data.washimas.map((item) => item.id)
        this.nagazap_ids = data.nagazaps.map((item) => item.id)
        this.expiry_minutes = data.expiry_minutes
        this.fuzzy_threshold = data.fuzzy_threshold

        // console.log(this)
    }

    load(data: BotPrisma) {
        this.id = data.id
        this.name = data.name
        this.created_at = data.created_at
        this.trigger = data.trigger
        this.triggered = data.triggered
        this.instance = JSON.parse(data.instance as string)
        this.active_on = JSON.parse(data.active_on as string)
        this.company_id = data.company_id
        this.washima_ids = data.washimas.map((item) => item.id)
        this.nagazap_ids = data.nagazaps.map((item) => item.id)
        this.expiry_minutes = data.expiry_minutes
        this.fuzzy_threshold = data.fuzzy_threshold
    }

    async update(data: Partial<Bot>) {
        const result = await prisma.bot.update({
            where: { id: this.id },
            data: {
                name: data.name,
                trigger: data.trigger,
                nagazaps: data.nagazap_ids ? { set: [], connect: data.nagazap_ids.map((id) => ({ id })) } : undefined,
                washimas: data.washima_ids ? { set: [], connect: data.washima_ids.map((id) => ({ id })) } : undefined,
                instance: JSON.stringify(data.instance),
                expiry_minutes: data.expiry_minutes,
                fuzzy_threshold: data.fuzzy_threshold,
            },
            include: bot_include,
        })

        this.load(result)
    }

    async getChannels() {
        // const washimas = Washima.washimas.filter()
    }

    async delete() {
        await prisma.bot.delete({ where: { id: this.id } })
    }

    async handleIncomingMessage(message: string, chat_id: string, response: (text: string) => Promise<void>, other_bots: Bot[]) {
        if (other_bots.some((bot) => bot.getActiveChat(chat_id))) return

        let current_chat = this.getActiveChat(chat_id)

        if (!current_chat && this.compareIncomingMessage(message) !== undefined) {
            current_chat = this.newChat(chat_id)
        }

        if (current_chat) {
            if (this.compareIncomingMessage(message, "reset") !== undefined) {
                this.closeChat(current_chat.chat_id)
                await response("bot reiniciado")
                return
            }

            const bot_responses = this.advanceChat(current_chat, message)
            if (bot_responses) {
                bot_responses.forEach((bot_message, index) => {
                    setTimeout(() => response(bot_message), index * 1000)
                })

                Bot.pending_response.set(current_chat.chat_id, {
                    chat_id: current_chat.chat_id,
                    response: response,
                    timestamp: now() + 1000 * 60 * this.expiry_minutes,
                    bot: this,
                })
            }
        }
    }

    getActiveChat(chat_id: string, incoming_message?: string) {
        const chat = this.active_on.find((item) => item.chat_id === chat_id)

        console.log({ chat })
        if (incoming_message && chat) {
            if (this.compareIncomingMessage(incoming_message, "reset") !== undefined) {
                return chat
            }
            if (this.getAnsweredNode(chat.current_node_id, incoming_message)) {
                return chat
            } else {
                return
            }
        }

        return chat
    }

    newChat(chat_id: string) {
        if (this.getActiveChat(chat_id)) return

        const chat = new ActiveBot({
            chat_id,
            current_node_id: this.instance.nodes[0].id,
            last_interaction: now(),
            started_at: now(),
        })

        this.active_on.push(chat)
        this.triggered += 1

        return chat
    }

    getNodeChildren(nodeId: string, type: "direct" | "recursive" = "direct") {
        if (type === "direct") {
            const children_ids = this.instance.edges.filter((edge) => edge.source === nodeId).map((edge) => edge.target)
            const children = this.instance.nodes.filter((node) => children_ids.includes(node.id))
            return children
        }

        const children = new Set<FlowNode>()
        const stack = [nodeId]

        while (stack.length > 0) {
            const currentId = stack.pop()
            if (currentId) {
                const node = this.instance.nodes.find((node) => node.id === currentId)
                if (node) {
                    children.add(node)

                    // Find children (i.e., nodes that the current node points to via edges)
                    const direct_children = this.getNodeChildren(currentId, "direct")
                    stack.push(...direct_children.map((node) => node.id))
                }
            }
        }

        return Array.from(children)
    }

    getAnsweredNode(node_id: string, incoming_message: string) {
        const children = this.getNodeChildren(node_id)
        const response_node = children.find(
            (item) => item.type === "response" && this.compareIncomingMessage(incoming_message, item.data.value) !== undefined
        )
        return response_node
    }

    advanceChat(chat: ActiveBot, incoming_message: string) {
        let answered_node: FlowNode | undefined
        if (chat.current_node_id === this.instance.nodes[0].id) {
            answered_node = this.instance.nodes[0]
        } else {
            answered_node = this.getAnsweredNode(chat.current_node_id, incoming_message)
        }

        if (answered_node) {
            const messages: string[] = []
            let current_node = answered_node
            let loop = true

            while (loop) {
                const next_node = this.getNextNode(current_node.id)
                if (!next_node) {
                    loop = false
                    this.closeChat(chat.chat_id)
                }

                if (next_node?.type === "response") {
                    loop = false
                }

                if (next_node?.type === "message") {
                    chat.current_node_id = next_node.id
                    chat.last_interaction = now()
                    current_node = next_node
                    messages.push(next_node.data.value)
                }
            }

            this.save()
            return messages
        } else {
            const options = this.getNodeChildren(chat.current_node_id).map((node) => node.data.value)
            return [`Não entendi. As opções são:\n* ${options.join("\n* ")}`]
        }
    }

    getNextNode(node_id: string) {
        const children = this.getNodeChildren(node_id)
        if (children.length > 0) return children[0]
    }

    async save() {
        await prisma.bot.update({ where: { id: this.id }, data: { active_on: JSON.stringify(this.active_on), triggered: this.triggered } })
    }

    closeChat(chat_id: string) {
        this.active_on = this.active_on.filter((item) => item.chat_id !== chat_id)
        this.save()
        Bot.pending_response.delete(chat_id)
    }

    normalize(text: string) {
        return text
            .normalize("NFD") // Decompor em caracteres normais e diacríticos.
            .replace(/[\u0300-\u036f]/g, "") // Remover diacríticos (marcas de acento).
            .toLowerCase()
            .replace(/[^a-z0-9 -]/g, "") // Remover caracteres que não são letras, números, espaços ou hífens.
            .trim()
    }

    compareIncomingMessage(message: string, trigger = this.trigger) {
        if (trigger === "") return trigger
        
        const potential_triggers = trigger.split(";").map((text) => text.trim())
        console.log({ potential_triggers })

        for (trigger of potential_triggers) {
            console.log({ trigger, threshold: this.fuzzy_threshold })

            if (this.fuzzy_threshold === 0) {
                if (trigger === message) return trigger

                // return
            } else {
                const triggers = [this.normalize(trigger)]
                const fuse = new Fuse(triggers, {
                    includeScore: true,
                    threshold: this.fuzzy_threshold, // Lower threshold for closer matches
                    ignoreLocation: true, // Ignores the location of the match which allows for more general matching
                    minMatchCharLength: 2, // Minimum character length of matches to consider
                })

                const result = fuse.search(this.normalize(message)).map((item) => item.item)
                if (result.length > 0) {
                    return result[0]
                }
            }

        }

    }
}

