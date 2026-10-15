import { api } from '../../../service';
export const dynamic = 'force-dynamic';
type Context = {params:Promise<{id:string}>};
export const POST = async (req:Request, context:Context) => api(req,'uploadPhoto',(await context.params).id);
