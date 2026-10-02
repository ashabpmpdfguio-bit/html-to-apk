const express=require("express");
const multer=require("multer");
const path=require("path");
const fs=require("fs");
const fsp=fs.promises;
const crypto=require("crypto");
const {execFile}=require("child_process");
const sanitize=require("sanitize-filename");
const sharp=require("sharp");

const app=express();
const PORT=process.env.PORT||3000;
const ROOT=__dirname, JOBS=path.join(ROOT,"jobs");
fs.mkdirSync(JOBS,{recursive:true});
const upload=multer({dest:JOBS,limits:{fileSize:50*1024*1024}});
app.use(express.static(ROOT,{index:"index.html"}));
app.get("/api/health",(req,res)=>res.json({ok:true,service:"html-to-apk-studio",node:process.version,time:new Date().toISOString()}));
const jobs=new Map();
function safe(s){return sanitize(String(s||"برنامه من")).replace(/[^\p{L}\p{N} _.-]/gu,"").trim().slice(0,40)||"برنامه من"}
function pkg(s){let x=s.normalize("NFKD").replace(/[^\x00-\x7F]/g,"").replace(/[^a-zA-Z0-9]+/g,"").toLowerCase()||"webapp";return "com.htmltoapk."+x.slice(0,22)}
async function rm(p){await fsp.rm(p,{recursive:true,force:true}).catch(()=>{})}
async function findHtml(dir){const out=[];async function walk(d){for(const e of await fsp.readdir(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())await walk(p);else if(/\.(html?|xhtml)$/i.test(e.name))out.push(p)}}await walk(dir);return out}
async function webContent(file,dst){await fsp.mkdir(dst,{recursive:true});const ext=path.extname(file.originalname).toLowerCase();if([".html",".htm",".xhtml"].includes(ext)){await fsp.copyFile(file.path,path.join(dst,"index.html"));return}if(ext!==".zip")throw Error("فقط HTML یا ZIP مجاز است.");await new Promise((resolve,reject)=>execFile("unzip",["-q","-o",file.path,"-d",dst],{timeout:60000},e=>e?reject(new Error("باز کردن ZIP ممکن نشد. مطمئن شوید ZIP سالم است.")):resolve()));const hs=await findHtml(dst);if(!hs.length)throw Error("داخل ZIP هیچ فایل HTML پیدا نشد.");const ix=hs.find(x=>path.basename(x).toLowerCase()==="index.html")||hs[0];if(path.resolve(ix)!==path.resolve(path.join(dst,"index.html")))await fsp.copyFile(ix,path.join(dst,"index.html"))}
async function makeIcon(file,res){await fsp.mkdir(res,{recursive:true});const sizes={mdpi:48,hdpi:72,xhdpi:96,xxhdpi:144,xxxhdpi:192};const source=file?await fsp.readFile(file.path):Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192"><rect width="192" height="192" rx="42" fill="#4f46e5"/><text x="96" y="118" text-anchor="middle" font-size="92" fill="white" font-family="Arial">W</text></svg>`);for(const [d,s] of Object.entries(sizes))await sharp(source).resize(s,s,{fit:"cover"}).png().toFile(path.join(res,`mipmap-${d}`,"ic_launcher.png"))}
function emit(id,state,message,extra={}){const j=jobs.get(id);if(j){j.state=state;j.message=message;Object.assign(j,extra)}}
function run(cmd,args,cwd){return new Promise((resolve,reject)=>execFile(cmd,args,{cwd,timeout:8*60*1000,maxBuffer:8*1024*1024},(e,stdout,stderr)=>e?reject(new Error((stderr||stdout||e.message||"").toString().slice(-5000))):resolve(stdout)))}
async function createAndroidProject(work,name,application){
 const base=path.join(work,"app");
 const dirs=[path.join(base,"src/main/assets"),path.join(base,"src/main/java",...application.split(".")),path.join(base,"src/main/res/values"),...['mdpi','hdpi','xhdpi','xxhdpi','xxxhdpi'].map(x=>path.join(base,"src/main/res","mipmap-"+x))];
 for(const d of dirs)await fsp.mkdir(d,{recursive:true});
 await fsp.writeFile(path.join(work,"settings.gradle"),`pluginManagement { repositories { google(); mavenCentral(); gradlePluginPortal() } }\ndependencyResolutionManagement { repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS); repositories { google(); mavenCentral() } }\nrootProject.name="HtmlToApk"\ninclude(":app")`);
 await fsp.writeFile(path.join(work,"build.gradle"),`plugins { id 'com.android.application' version '8.7.3' apply false }`);
 await fsp.writeFile(path.join(work,"gradle.properties"),`org.gradle.jvmargs=-Xmx1536m\nandroid.useAndroidX=true`);
 await fsp.writeFile(path.join(base,"build.gradle"),`plugins { id 'com.android.application' }\nandroid { namespace '${application}'; compileSdk 35\n defaultConfig { applicationId '${application}'; minSdk 23; targetSdk 35; versionCode 1; versionName '1.0' }\n}`);
 await fsp.writeFile(path.join(base,"src/main/AndroidManifest.xml"),`<manifest xmlns:android="http://schemas.android.com/apk/res/android"><uses-permission android:name="android.permission.INTERNET"/><application android:theme="@style/AppTheme" android:label="${name.replace(/&/g,'&amp;').replace(/"/g,'&quot;')}" android:icon="@mipmap/ic_launcher" android:usesCleartextTraffic="true"><activity android:name="${application}.MainActivity" android:exported="true"><intent-filter><action android:name="android.intent.action.MAIN"/><category android:name="android.intent.category.LAUNCHER"/></intent-filter></activity></application></manifest>`);
 await fsp.writeFile(path.join(base,"src/main/java",...application.split("."),"MainActivity.java"),`package ${application};\nimport android.app.Activity;import android.os.Bundle;import android.webkit.*;\npublic class MainActivity extends Activity{public void onCreate(Bundle b){super.onCreate(b);WebView w=new WebView(this);w.setWebViewClient(new WebViewClient());w.setWebChromeClient(new WebChromeClient());WebSettings s=w.getSettings();s.setJavaScriptEnabled(true);s.setDomStorageEnabled(true);s.setAllowFileAccess(true);s.setAllowContentAccess(true);s.setMediaPlaybackRequiresUserGesture(false);w.loadUrl("file:///android_asset/index.html");setContentView(w);}}`);
 await fsp.writeFile(path.join(base,"src/main/res/values/styles.xml"),`<resources><style name="AppTheme" parent="android:style/Theme.Material.Light.NoActionBar"><item name="android:fontFamily">sans</item><item name="android:colorAccent">#4f46e5</item></style></resources>`);
}
app.post("/api/build",upload.fields([{name:"webfile",maxCount:1},{name:"icon",maxCount:1}]),async(req,res)=>{const id=crypto.randomBytes(7).toString("hex"),web=req.files?.webfile?.[0],ico=req.files?.icon?.[0];if(!web)return res.status(400).json({error:"فایل HTML یا ZIP انتخاب نشده است."});jobs.set(id,{state:"queued",message:"در صف ساخت…",progress:5,createdAt:Date.now()});res.json({id});(async()=>{const work=path.join(JOBS,id);try{const name=safe(req.body.appName),application=pkg(name);emit(id,"working","در حال آماده‌سازی پروژه…",{progress:15});await createAndroidProject(work,name,application);emit(id,"working","در حال آماده‌سازی فایل‌های وب…",{progress:23});await webContent(web,path.join(work,"app/src/main/assets"));emit(id,"working","در حال آماده‌سازی آیکن…",{progress:30});await makeIcon(ico,path.join(work,"app/src/main/res"));emit(id,"working","در حال کامپایل APK…",{progress:42});await run(process.env.GRADLE_CMD||"gradle",["assembleRelease","--no-daemon"],work);const apk=path.join(work,"app/build/outputs/apk/release/app-release.apk");if(!fs.existsSync(apk))throw Error("Gradle اجرا شد اما فایل APK پیدا نشد.");emit(id,"done","APK با موفقیت آماده شد.",{progress:100,file:apk,name:name.replace(/\s+/g,"_")+".apk"})}catch(e){console.error("BUILD",id,e);emit(id,"error","ساخت APK ناموفق بود.",{progress:0,error:String(e.message||e).slice(0,5000)})}finally{if(web)await fsp.rm(web.path,{force:true}).catch(()=>{});if(ico)await fsp.rm(ico.path,{force:true}).catch(()=>{})}})()});
app.get("/api/status/:id",(req,res)=>{const j=jobs.get(req.params.id);if(!j)return res.status(404).json({error:"پروژه پیدا نشد."});const x={...j};delete x.file;res.json(x)});
app.get("/api/download/:id",(req,res)=>{const j=jobs.get(req.params.id);if(!j||j.state!=="done"||!j.file||!fs.existsSync(j.file))return res.status(404).send("APK آماده نیست یا منقضی شده است.");res.download(j.file,j.name)});
setInterval(async()=>{const cutoff=Date.now()-30*60*1000;for(const [id,j] of jobs)if(j.createdAt&&j.createdAt<cutoff){jobs.delete(id);await rm(path.join(JOBS,id))}},5*60*1000);
app.listen(PORT,"0.0.0.0",()=>console.log(`HTML → APK Studio: http://0.0.0.0:${PORT}`));
