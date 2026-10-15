import { api } from '../../service';
export const dynamic = 'force-dynamic';
type Context = {params:Promise<{photoId:string}>};
export const GET = async (req:Request, context:Context) => api(req,'photo',(await context.params).photoId);
