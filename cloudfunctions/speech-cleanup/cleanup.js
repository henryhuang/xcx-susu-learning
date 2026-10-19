const get = async (store, name, id) => (await store.collection(name).doc(id).get()).data;
async function cleanup({db,storage,now=Date.now}) {
  const time=now();
  const rows=(await db.collection('speech_recordings').where({expiresAt:db.command.gt(0).and(db.command.lte(time))}).limit(20).get()).data;
  let deleted=0;
  for(const row of rows){
    if(!['staging','obsolete','deleting'].includes(row.state) || !row.path || !/^[a-z][a-z0-9_-]{0,31}$/.test(row.learnerId || '') || row.path !== `speech/${row.learnerId}/${row.summaryId}/${row._id}.mp3` || !/^[a-zA-Z0-9-]+$/.test(row.summaryId || '') || !/^[a-zA-Z0-9-]+$/.test(row._id || '') || !row.fileID || !row.fileID.endsWith('/'+row.path))continue;
    const claimed=await db.runTransaction(async tx=>{
      const journal=await get(tx,'speech_recordings',row._id);
      if(!journal || journal.fileID!==row.fileID || journal.state==='active' || journal.expiresAt>time) return false;
      const summary=await get(tx,'speech_summaries',journal.summaryId);
      if(summary&&summary.recording&&(summary.recording.attemptId===row._id || summary.recording.fileID===row.fileID)){
        await tx.collection('speech_recordings').doc(row._id).update({data:{state:'active',expiresAt:0}});return false;
      }
      await tx.collection('speech_recordings').doc(row._id).update({data:{state:'deleting',expiresAt:time+600000}});
      return true;
    });
    if(!claimed)continue;
    try{
      await storage.delete(row.fileID);
      await db.collection('speech_recordings').doc(row._id).update({data:{state:'deleted',expiresAt:0,deletedAt:now()}});
      deleted++;
    }catch(_){ /* Leave deletion lease for a later timer retry. */ }
  }
  return {ok:true,deleted};
}
module.exports={cleanup};
