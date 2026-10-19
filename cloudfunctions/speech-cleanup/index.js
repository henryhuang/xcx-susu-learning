const cloud=require('wx-server-sdk');
const {cleanup}=require('./cleanup');
cloud.init({env:cloud.DYNAMIC_CURRENT_ENV});
exports.main=async event=>{
  // Only a console timer may invoke cleanup; do not enable HTTP triggers.
  if(!event || event.Type!=='Timer' || event.httpMethod || cloud.getWXContext().OPENID || process.env.SPEECH_CLEANUP_ENABLED!=='true')return {ok:false,code:'UNAUTHORIZED'};
  const db=cloud.database({throwOnNotFound:false});
  return cleanup({db,storage:{async delete(fileID){
    const result=await cloud.deleteFile({fileList:[fileID]});
    if(!result.fileList || result.fileList.some(item=>item.status!==0))throw new Error('DELETE_FAILED');
  }}});
};
