// JPEG encoding is supported on iPhone browsers where WebP encoding can fall back to PNG.
export const PHOTO_MAX_BYTES=450000;

export async function compressProductPhoto(image,makeCanvas=()=>document.createElement('canvas')) {
 const width=image.naturalWidth||image.width,height=image.naturalHeight||image.height;
 if(!width||!height)throw new Error('Não foi possível ler essa foto. Escolha outra imagem.');
 const canvas=makeCanvas();
 try {
  for(const edge of [1100,880,704,563,450,360,288,230]) {
   const scale=Math.min(1,edge/Math.max(width,height));
   canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
   const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Não foi possível preparar a foto neste navegador.');
   // Keep transparent PNG backgrounds white when converting to JPEG.
   ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);
   ctx.drawImage(image,0,0,canvas.width,canvas.height);
   for(const quality of [.86,.72,.58]) {
    const blob=await new Promise((resolve,reject)=>{
     if(typeof canvas.toBlob!=='function'){reject(new Error('Atualize o navegador para enviar fotos.'));return;}
     canvas.toBlob(resolve,'image/jpeg',quality);
    });
    if(blob&&blob.size>0&&blob.size<=PHOTO_MAX_BYTES&&['image/jpeg','image/png','image/webp'].includes(blob.type))return blob;
   }
  }
  throw new Error('Não foi possível preparar essa foto. Tente outra imagem ou uma captura de tela dela.');
 } finally {canvas.width=1;canvas.height=1;}
}

export async function prepareProductPhoto(file) {
 const supported=['image/jpeg','image/jpg','image/png','image/webp'];
 const namedImage=/\.(jpe?g|png|webp)$/i.test(file.name||'');
 if(!supported.includes(file.type)&&!(file.type===''&&namedImage))throw new Error('Escolha uma foto JPG, PNG ou WebP. Se estiver em HEIC, exporte como JPG ou envie uma captura de tela.');
 if(file.size>30000000)throw new Error('Escolha uma foto de até 30 MB.');
 const url=URL.createObjectURL(file),image=new Image();
 try {
  await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error('Não foi possível abrir essa foto. Escolha outra imagem ou uma captura de tela dela.'));image.src=url;});
  const blob=await compressProductPhoto(image);
  return await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Não foi possível ler a foto preparada. Tente novamente.'));reader.readAsDataURL(blob);});
 } finally {image.onload=null;image.onerror=null;image.src='';URL.revokeObjectURL(url);}
}
