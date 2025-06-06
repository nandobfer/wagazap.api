import express, { Express, Request, Response } from "express"
import { MessageWebhook } from "../../types/shared/Meta/WhatsappBusiness/MessageWebhook"
import { NagaMessageType, NagaTemplate, Nagazap } from "../../class/Nagazap"
import { TemplateUpdateHook } from "../../types/shared/Meta/WhatsappBusiness/TemplatesInfo"
import { getIoInstance } from "../../io/socket"

const router = express.Router()

// https://apichat.boz.app.br/nagazap/webhook/messages

router.get("/messages", async (request: Request, response: Response) => {
    const mode = request.query["hub.mode"]

    if (mode == "subscribe") {
        try {
            const challenge = request.query["hub.challenge"]

            response.status(200).send(challenge)
        } catch (error) {
            console.log(error)
            response.status(500).send(error)
        }
    } else {
        response.status(400).send("hub.mode should be subscribe")
    }
})

router.post("/messages", async (request: Request, response: Response) => {
    try {
        const data = request.body as MessageWebhook
        console.log(JSON.stringify(data, null, 4))
        const businessId = data.entry[0].id
        const nagazap = await Nagazap.getByBusinessId(businessId)
        data.entry?.forEach(async (entry) => {
            entry.changes?.forEach(async (change) => {
                // MENSAGEM
                if (change.field === "messages") {
                    console.log("incoming message webhook")
                    change.value.messages?.forEach(async (message) => {
                        console.log(message)
                        const data_types: { type: NagaMessageType; data?: string; media_url?: string }[] = [
                            { type: "audio", media_url: message.audio?.id },
                            { type: "image", data: message.image?.caption, media_url: message.image?.id },
                            { type: "reaction", data: message.reaction?.emoji },
                            { type: "sticker", media_url: message.sticker?.id },
                            { type: "text", data: message.text?.body },
                            { type: "video", data: message.video?.caption, media_url: message.video?.id },
                            { type: "button", data: message.button?.text },
                            {
                                type: "interactive",
                                data:
                                    message.interactive?.type === "button_reply"
                                        ? message.interactive.button_reply?.title
                                        : message.interactive?.type === "list_reply"
                                        ? message.interactive.list_reply?.title
                                        : undefined,
                            },
                        ]
                        const data = data_types.find((item) => item.type === message.type)
                        if (data && data.media_url) {
                            if (!["text", "button", "reaction", "interactive"].includes(data.type)) {
                                const media_url = await nagazap.downloadMedia(data.media_url)
                                data.media_url = media_url
                            }
                        }

                        nagazap.saveMessage({
                            from: message.from.slice(2),
                            text: data?.data || "",
                            timestamp: message.timestamp,
                            name: change.value.contacts[0].profile?.name || "",
                            type: message.type,
                            from_bot: null,
                            media_url: data?.media_url || null,
                        })
                    })
                }

                // TEMPLATE
                if (change.field === "message_template_status_update") {
                    const template = change.value as unknown as TemplateUpdateHook
                    console.log("template webhook")
                    console.log(template)
                    try {
                        await NagaTemplate.update({ id: template.message_template_id.toString(), info: { status: template.event } })
                        const io = getIoInstance()
                        io.emit("template:update", { id: template.message_template_id.toString(), status: template.event })
                    } catch (error) {
                        console.log(error)
                    }
                }
            })
        })
        response.status(200).send()
    } catch (error) {
        console.log(error)
        response.status(500).send(error)
    }
})

router.get("/media", async (request: Request, response: Response) => {
    const mode = request.query["hub.mode"]

    if (mode == "subscribe") {
        try {
            const challenge = request.query["hub.challenge"]

            response.status(200).send(challenge)
        } catch (error) {
            console.log(error)
            response.status(500).send(error)
        }
    } else {
        response.status(400).send("hub.mode should be subscribe")
    }
})

router.post("/media", async (request: Request, response: Response) => {
    const data = request.body

    try {
        console.log(JSON.stringify(data, null, 4))
        response.status(200).send()
    } catch (error) {
        console.log(error)
        response.status(500).send(error)
    }
})

export default router
