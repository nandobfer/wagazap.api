import { WhatsappInteractiveForm } from "../../../../class/Nagazap"
import { TemplateInfo } from "./TemplatesInfo"

export interface WhatsappForm {
    number: string
    template: string
    language: "en_US" | "pt_BR"
    components?: WhatsappTemplateComponent[]
}

export interface WhatsappMedia {
    id?: string
    link?: string
    caption?: string
    upload?: File
}

export interface WhatsappTemplateParams {
    type: "text" | "currency" | "date_time" | "image" | "document" | "video"
    text?: string
    currency?: string
    date_time?: string
    image?: WhatsappMedia
    video?: WhatsappMedia
    document?: WhatsappMedia
    parameter_name?: string
}

export interface WhatsappTemplateComponent {
    type: "header" | "body" | "footer"
    parameters: WhatsappTemplateParams[]
}

export interface NagazapMediaItem {
    id?: string
    link?: string
    caption?: string
}

export interface WhatsappApiForm {
    messaging_product: "whatsapp"
    to: string
    type: "template" | "text" | "image" | "video" | "audio" | "document" | "interactive"
    template?: {
        name: string
        language: {
            code: "en_US" | "pt_BR"
        }
        components?: WhatsappTemplateComponent[]
    }

    text?: {
        preview_url: boolean
        body: string
    }

    image?: NagazapMediaItem
    video?: NagazapMediaItem
    recipient_type?: "individual"
    interactive?: WhatsappInteractiveForm
}

export interface OvenForm {
    to: { telefone: string; [key: string]: string }[]
    template_id: string
}
