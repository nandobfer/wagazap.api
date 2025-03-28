import express, { Express, Request, Response } from "express"
import { requireUserId, UserRequest } from "../../middlewares/requireUserId"
import { CompanyRequest, requireCompanyId } from "../../middlewares/requireCompanyId"
import { Board, BoardAccess, BoardForm } from "../../class/Board/Board"
import { Log } from "../../class/Log"
import { BoardRequest, requireBoardId } from "../../middlewares/requireBoardId"

const router = express.Router()

router.use(requireUserId)
router.use(requireCompanyId)

type UserCompanyRequest = UserRequest & CompanyRequest
type BoardAuthRequest = BoardRequest & UserCompanyRequest

router.get("/", async (request: UserCompanyRequest, response: Response) => {
    const { board_id } = request.query

    try {
        if (board_id) {
        } else {
            const boards = await request.user!.getBoards()
            return response.json(boards)
        }
    } catch (error) {
        console.log(error)
        response.status(500).send(error)
    }
})

router.post("/", async (request: UserCompanyRequest, response: Response) => {
    const data = request.body as BoardForm

    try {
        const board = await Board.new(data, request.company!.id)
        Log.new({ company_id: request.company!.id, text: `criou o quadro ${board.name}`, user_id: request.user!.id, type: "boards" })
        return response.json(board)
    } catch (error) {
        console.log(error)
        response.status(500).send(error)
    }
})

router.use(requireBoardId)

router.patch("/", async (request: BoardAuthRequest, response: Response) => {
    const data = request.body as Partial<Board> & { access?: BoardAccess }

    try {
        if (data.washima_settings) {
            await request.board!.handleWashimaSettingsChange(data.washima_settings)
        }

        if (data.nagazap_settings) {
            await request.board!.handleNagazapSettingsChange(data.nagazap_settings)
        }

        if (data.access) {
            await request.board!.changeAccess(data.access)
        }

        await request.board!.update(data)
        response.json(request.board)
    } catch (error) {
        console.log(error)
        response.status(500).send(error)
    }
})

router.delete("/", async (request: BoardAuthRequest, response: Response) => {
    try {
        await request.board!.delete()
        Log.new({ company_id: request.company!.id, text: `deletou o quadro ${request.board!.name}`, user_id: request.user!.id, type: "boards" })
        return response.json(request.board)
    } catch (error) {
        console.log(error)
        response.status(500).send(error)
    }
})

router.get("/access", async (request: BoardAuthRequest, response: Response) => {
    try {
        const access = await request.board!.getAccess()
        return response.json(access)
    } catch (error) {
        console.log(error)
        response.status(500).send(error)
    }
})

export default router
