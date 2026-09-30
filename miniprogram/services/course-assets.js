let directory='';
function setDirectory(value){directory=value||'';}
function resolve(value){return directory&&/^\/(?:assets|chinese\/assets)\/[a-zA-Z0-9_./-]+$/.test(value)&&!value.includes('..')?directory+value:value;}
module.exports={setDirectory,resolve};
