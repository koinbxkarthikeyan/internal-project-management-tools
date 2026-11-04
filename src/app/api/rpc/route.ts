import { handleRpc } from "@/lib/server/rpc";

export const dynamic = "force-dynamic";

export const POST = (req: Request) => handleRpc(req);
