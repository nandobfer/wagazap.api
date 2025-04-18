import { Socket } from "socket.io"
import { Server as SocketIoServer } from "socket.io"
import { Server as HttpServer } from "http"
import { Server as HttpsServer } from "https"
import { Washima, WashimaMediaForm } from "../class/Washima/Washima"
import { WashimaMessage } from "../class/Washima/WashimaMessage"
import { Nagazap, NagazapResponseForm } from "../class/Nagazap"
import { Board } from "../class/Board/Board"

let io: SocketIoServer | null = null

export const initializeIoServer = (server: HttpServer | HttpsServer) => {
    io = new SocketIoServer(server, {
        cors: { origin: "*" },
        maxHttpBufferSize: 1e8,
    })
}

export const getIoInstance = () => {
    if (!io) {
        throw new Error("Socket.IO has not been initialized. Please call initializeIoServer first.")
    }
    return io
}

export const handleSocket = (socket: Socket) => {
    console.log(`new connection: ${socket.id}`)

    socket.on("disconnect", async (reason) => {
        console.log(`disconnected: ${socket.id}`)
        console.log({ reason })
    })

    socket.on("washima:message", (washima_id: string, chat_id: string, message?: string, media?: WashimaMediaForm, replyMessage?: WashimaMessage) =>
        Washima.sendMessage(socket, washima_id, chat_id, message, media, replyMessage)
    )
    socket.on("washima:message:contact", (washima_id: string, contact_id: string, message_id: string) =>
        Washima.getContact(socket, washima_id, contact_id, message_id)
    )

    socket.on("washima:forward", (washima_id: string, chat_id: string, destinatary_ids: string[], message_ids: string[]) =>
        Washima.forwardMessage(socket, washima_id, chat_id, destinatary_ids, message_ids)
    )

    socket.on("nagazap:response", (nagazap_id: string, data: NagazapResponseForm) => Nagazap.sendResponse(nagazap_id, data))

    Board.handleSocket(socket)
}
