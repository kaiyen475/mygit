import { api } from '../../../../service';
export const dynamic = 'force-dynamic';
type Context = {params:Promise<{id:string;photoId:string}>};
export const DELETE = async (req:Request, context:Context) => {
  const {id,photoId}=await context.params;
  return api(req,'deletePhoto',id,photoId);
};
