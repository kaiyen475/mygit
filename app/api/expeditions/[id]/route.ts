import { api } from '../../service';
export const dynamic = 'force-dynamic';
type Context = {params:Promise<{id:string}>};
export const GET = async (req:Request, context:Context) => api(req,'detail',(await context.params).id);
export const PUT = async (req:Request, context:Context) => api(req,'save',(await context.params).id);
export const DELETE = async (req:Request, context:Context) => api(req,'delete',(await context.params).id);
