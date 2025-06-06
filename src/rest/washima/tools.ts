import express, { Express, Request, Response } from "express"
import { Washima } from "../../class/Washima/Washima"
import { WashimaMessage } from "../../class/Washima/WashimaMessage"
import { requireUserId, UserRequest } from "../../middlewares/requireUserId"
import { Log } from "../../class/Log"
import { CompanyRequest, requireCompanyId } from "../../middlewares/requireCompanyId"
const router = express.Router()

router.get("/disk-usage", async (request: Request, response: Response) => {
    const washima_id = request.query.washima_id as string | undefined

    if (washima_id) {
        try {
            const washima = await Washima.query(washima_id)
            const disk_usage = await washima.getDiskUsage()
            response.json(disk_usage)
        } catch (error) {
            console.log(error)
            response.status(500).send(error)
        }
    } else {
        response.status(400).send("washima_id param is required")
    }
})

router.get("/copy-chat", async (request: Request, response: Response) => {
    const chat_id = request.query.chat_id as string | undefined
    const washima_id = request.query.washima_id as string | undefined
    const is_group = request.query.is_group as string | undefined

    if (chat_id && washima_id) {
        try {
            const messages = await WashimaMessage.getChatMessages(washima_id, chat_id, !!is_group, 0, null)
            response.json(messages)
        } catch (error) {
            console.log(error)
            response.status(500).send(error)
        }
    } else {
        response.status(400).send("chat_id and washima_id params are required")
    }
})

router.use(requireUserId)
router.use(requireCompanyId)

router.delete("/media", async (request: UserRequest & CompanyRequest, response: Response) => {
    const data = request.body as { washima_id: string }

    try {
        const washima = await Washima.query(data.washima_id)
        const deletion_count = await washima.clearMedia()

        if (washima) {
            Log.new({
                company_id: request.company!.id,
                user_id: request.user!.id,
                text: `deletou todas as mídias de ${washima.name} - ${washima.number} no Business`,
                type: "washima",
            })
        }

        response.json(deletion_count)
    } catch (error) {
        console.log(error)
        response.status(500).send(error)
    }
})

router.delete("/messages", async (request: UserRequest & CompanyRequest, response: Response) => {
    const data = request.body as { washima_id: string }

    try {
        const washima = await Washima.query(data.washima_id)
        const deletion_count = await washima.clearMessages()
        if (washima) {
            Log.new({
                company_id: request.company!.id,
                user_id: request.user!.id,
                text: `deletou todas as mensagens de ${washima.name} - ${washima.number} no Business`,
                type: "washima",
            })
        }
        response.json(deletion_count)
    } catch (error) {
        console.log(error)
        response.status(500).send(error)
    }
})


export default router
