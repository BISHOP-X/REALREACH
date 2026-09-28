// One-time operator utility. Never imported by the website.
// Produces owner-only local credentials; stdout contains no passwords or tokens.
import {randomBytes,createHash} from 'node:crypto';
import {mkdirSync,writeFileSync,readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
const directory=resolve('.local-credentials'),file=resolve(directory,'pass12.json');
const url='https://jabwuawiqsusjrccapab.supabase.co';
if(process.argv[2]==='prepare'){
  if(existsSync(file))throw new Error('Provisioning material already exists. Do not overwrite it.');
  mkdirSync(directory,{recursive:true,mode:0o700});
  if(process.platform==='win32')execFileSync('icacls.exe',[directory,'/inheritance:r','/grant:r',`${process.env.USERDOMAIN}\\${process.env.USERNAME}:(OI)(CI)F`],{stdio:'pipe'});
  const tag=Date.now().toString(36),nonce=randomBytes(32).toString('hex');
  const users=[{name:'admin',email:'admin@realreach.com.ng'},{name:'a',email:`rr-qa-a-${tag}@example.com`},{name:'b',email:`rr-qa-b-${tag}@example.com`}].map(u=>({...u,password:randomBytes(30).toString('base64url')}));
  const material={nonce,expires:Date.now()+15*60_000,users};
  writeFileSync(file,JSON.stringify(material,null,2),{mode:0o600,flag:'wx'});
  console.log(JSON.stringify({hash:createHash('sha256').update(nonce).digest('hex'),expires:material.expires,users:users.map(({name,email})=>({name,email}))}));
}else{
  const material=JSON.parse(readFileSync(file,'utf8'));
  const operation=process.argv[2];
  if(!['create','cleanup'].includes(operation))throw new Error('Use prepare, create or cleanup');
  const response=await fetch(`${url}/functions/v1/identity-provision`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${material.nonce}`},body:JSON.stringify({operation,users:material.users})});
  const result=await response.json();
  if(!response.ok)throw new Error(`Provisioning failed (${response.status}); inspect redacted function logs.`);
  if(operation==='create'){
    for(const user of material.users)user.id=result.ids[user.name];
    writeFileSync(file,JSON.stringify(material,null,2),{mode:0o600});
    const admin=material.users.find(u=>u.name==='admin');
    writeFileSync(resolve(directory,'admin.json'),JSON.stringify({email:admin.email,password:admin.password,project:url,note:'Enroll an authenticator and confirm your recovery inbox before launch.'},null,2),{mode:0o600,flag:'wx'});
  }
  console.log(`${operation} succeeded. Credentials remain in the owner-only .local-credentials directory.`);
}
