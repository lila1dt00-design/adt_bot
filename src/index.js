const j=(x,s=200)=>new Response(JSON.stringify(x),{status:s,headers:{"content-type":"application/json"}});
const h=(x,s=200)=>new Response(x,{status:s,headers:{"content-type":"text/html; charset=utf-8"}});

async function api(e,m,p){
 const r=await fetch(`https://api.telegram.org/bot${e.BOT_TOKEN}/${m}`,{
  method:"POST",
  headers:{"content-type":"application/json"},
  body:JSON.stringify(p)
 });
 return r.json();
}

async function say(e,c,t,k){
 return api(e,"sendMessage",{
  chat_id:c,text:t,parse_mode:"HTML",
  ...(k?{reply_markup:{inline_keyboard:k}}:{})
 });
}

function meta(m){
 const b=[m.text,m.caption].filter(Boolean).join("\n");
 const l=b.toLowerCase();

 let game=/e[\s-]?football/i.test(b)?"eFootball":
 /pes\s*2021|pes21/i.test(b)?"PES 2021":
 /pes\s*2020|pes20/i.test(b)?"PES 2020":
 /pes\s*2017|pes17/i.test(b)?"PES 2017":
 /pes\s*2013|pes13/i.test(b)?"PES 2013":"Other";

 let dev=["nyan","luffy","ziru","efootxi","kipas"].find(x=>l.includes(x))||"Other";
 dev=({luffy:"LuffyDev",efootxi:"eFootXi"})[dev]||dev[0].toUpperCase()+dev.slice(1);

 let v=b.match(/\bv?\d+(?:\.\d+){0,3}\b/i);

 return {
  game,developer:dev,
  version:v?v[0]:"Unspecified",
  title:(b.split("\n").find(x=>x.trim())||"Channel post").slice(0,180),
  body:b.slice(0,4000)
 };
}

async function index(e,m){
 const x=meta(m);
 await e.DB.prepare(`
 INSERT INTO posts(chat_id,message_id,game,developer,version,title,body,created_at)
 VALUES(?,?,?,?,?,?,?,?)
 ON CONFLICT(chat_id,message_id) DO UPDATE SET
 game=excluded.game,developer=excluded.developer,
 version=excluded.version,title=excluded.title,body=excluded.body
 `).bind(
  String(m.chat.id),m.message_id,x.game,x.developer,
  x.version,x.title,x.body,m.date||Date.now()/1000|0
 ).run();
}

async function menu(e,c){
 const {results=[]}=await e.DB.prepare(
  "SELECT game,COUNT(*) n FROM posts GROUP BY game ORDER BY game"
 ).all();

 if(!results.length)
  return say(e,c,"لا توجد منشورات مفهرسة بعد.");

 return say(e,c,"اختر اللعبة:",
  results.map(x=>[{
   text:`${x.game} (${x.n})`,
   callback_data:`g|${encodeURIComponent(x.game)}`
  }])
 );
}

async function cb(e,q){
 const c=q.message.chat.id;
 const p=q.data.split("|");

 await api(e,"answerCallbackQuery",{callback_query_id:q.id});

 if(p[0]==="home") return menu(e,c);

 if(p[0]==="g"){
  const game=decodeURIComponent(p[1]);
  const {results=[]}=await e.DB.prepare(
   "SELECT developer,COUNT(*) n FROM posts WHERE game=? GROUP BY developer"
  ).bind(game).all();

  return say(e,c,"اختر المطور:",[
   ...results.map(x=>[{
    text:`${x.developer} (${x.n})`,
    callback_data:`d|${p[1]}|${encodeURIComponent(x.developer)}`
   }]),
   [{text:"↩ الألعاب",callback_data:"home"}]
  ]);
 }

 if(p[0]==="d"){
  const game=decodeURIComponent(p[1]);
  const dev=decodeURIComponent(p[2]);

  const {results=[]}=await e.DB.prepare(
   "SELECT version,COUNT(*) n FROM posts WHERE game=? AND developer=? GROUP BY version"
  ).bind(game,dev).all();

  return say(e,c,"اختر الإصدار:",[
   ...results.map(x=>[{
    text:`${x.version} (${x.n})`,
    callback_data:`v|${p[1]}|${p[2]}|${encodeURIComponent(x.version)}`
   }]),
   [{text:"↩ المطورون",callback_data:`g|${p[1]}`}]
  ]);
 }

 if(p[0]==="v"){
  const vals=p.slice(1).map(decodeURIComponent);
  const {results=[]}=await e.DB.prepare(
   "SELECT id,title FROM posts WHERE game=? AND developer=? AND version=? ORDER BY created_at DESC LIMIT 25"
  ).bind(...vals).all();

  return say(e,c,"المنشورات:",[
   ...results.map(x=>[{
    text:x.title.slice(0,60),
    callback_data:`p|${x.id}`
   }]),
   [{text:"↩ الإصدارات",callback_data:`d|${p[1]}|${p[2]}`}]
  ]);
 }

 if(p[0]==="p"){
  const x=await e.DB.prepare(
   "SELECT chat_id,message_id FROM posts WHERE id=?"
  ).bind(+p[1]).first();

  if(x){
   return api(e,"copyMessage",{
    chat_id:c,
    from_chat_id:x.chat_id,
    message_id:x.message_id
   });
  }
 }
}

const ADMIN=`<!doctype html>
<html lang="ar" dir="rtl">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width">
<title>Adt Admin</title>

<style>
body{
 font:16px system-ui;
 background:#101827;
 color:#eef;
 padding:24px;
 max-width:900px;
 margin:auto
}
.card{
 background:#1d293b;
 padding:18px;
 border-radius:12px;
 margin:14px 0
}
input,button{
 box-sizing:border-box;
 width:100%;
 padding:12px;
 margin:6px 0;
 border-radius:7px
}
input{
 background:#0e1726;
 color:white;
 border:1px solid #567
}
button{
 background:#2563eb;
 color:white;
 border:0;
 cursor:pointer
}
.item{
 background:#0e1726;
 padding:12px;
 margin:8px 0;
 border-radius:8px;
 overflow-wrap:anywhere
}
small{color:#aab}
</style>

<h1>Adt Bot — لوحة الإدارة</h1>

<div class="card">
 <input id="pw" type="password" placeholder="كلمة مرور الإدارة">
 <button onclick="load()">دخول / تحديث</button>
 <p id="s"></p>
</div>

<div class="card">
 <h3>➕ إضافة إصدار جديد</h3>

 <input id="game" placeholder="اللعبة مثال: eFootball 27">

 <input id="dev" placeholder="المطور مثال: eFootXi">

 <input id="ver" placeholder="اسم الإصدار مثال: eFootXi 1.7">

 <input id="url" placeholder="رابط المنشور https://t.me/teamadt/123">

 <button onclick="add()">حفظ الإصدار</button>
</div>

<div class="card">
 <h3>المنشورات المضافة</h3>
 <div id="items"></div>
</div>

<script>
const $=x=>document.getElementById(x);

const H=()=>({
 Authorization:"Bearer "+$("pw").value,
 "Content-Type":"application/json"
});

async function load(){
 let r=await fetch("/api/admin/items",{headers:H()});
 let d=await r.json();

 $("s").textContent=r.ok?"تم الاتصال":"خطأ "+r.status;

 $("items").innerHTML=(d.items||[]).map(x=>
  '<div class="item"><b>'+safe(x.title)+'</b><br>'+
  '<small>'+safe(x.game)+' / '+safe(x.developer)+' / '+safe(x.version)+'</small><br>'+
  '<small>'+safe(x.chat_id)+' / '+x.message_id+'</small></div>'
 ).join("");
}

function safe(x){
 return String(x??"").replace(/[&<>"']/g,c=>({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
 }[c]));
}

async function add(){
 let b={
  game:$("game").value.trim(),
  developer:$("dev").value.trim(),
  version:$("ver").value.trim(),
  title:$("ver").value.trim(),
  post_url:$("url").value.trim()
 };

 let r=await fetch("/api/admin/items",{
  method:"POST",
  headers:H(),
  body:JSON.stringify(b)
 });

 let d=await r.json();

 $("s").textContent=r.ok?"تم حفظ الإصدار بنجاح":(d.error||"فشل الحفظ");

 if(r.ok){
  $("ver").value="";
  $("url").value="";
  load();
 }
}
</script>
</html>`;

async function admin(req,e){
 if(req.headers.get("Authorization")!==`Bearer ${e.ADMIN_PASSWORD}`)
  return j({error:"Unauthorized"},401);

 if(req.method==="GET"){
  const {results=[]}=await e.DB.prepare(
   "SELECT id,chat_id,message_id,game,developer,version,title FROM posts ORDER BY created_at DESC LIMIT 200"
  ).all();

  return j({items:results});
 }

 if(req.method==="POST"){
  const x=await req.json();

  let u;
  try{
   u=new URL(x.post_url||"");
  }catch{
   return j({error:"رابط غير صالح"},400);
  }

  const m=u.pathname.match(/^\/(?:s\/)?(teamadt)\/(\d+)\/?$/);

  if(!["t.me","www.t.me","telegram.me"].includes(u.hostname)||!m)
   return j({error:"ضع رابط منشور من قناة https://t.me/teamadt/123"},400);

  if(!x.game||!x.developer||!x.version)
   return j({error:"أكمل اللعبة والمطور واسم الإصدار"},400);

  const chat="@"+m[1];
  const msg=+m[2];

  await e.DB.prepare(`
   INSERT INTO posts(chat_id,message_id,game,developer,version,title,body,created_at)
   VALUES(?,?,?,?,?,?,?,?)
   ON CONFLICT(chat_id,message_id) DO UPDATE SET
   game=excluded.game,
   developer=excluded.developer,
   version=excluded.version,
   title=excluded.title,
   body=excluded.body
  `).bind(
   chat,msg,x.game,x.developer,x.version,
   x.title||x.version,x.title||x.version,Date.now()/1000|0
  ).run();

  return j({ok:true});
 }

 return j({error:"Method not allowed"},405);
}

export default{
 async fetch(r,e){
  const u=new URL(r.url);

  try{
   if(u.pathname==="/telegram/webhook"&&r.method==="POST"){
    if(r.headers.get("X-Telegram-Bot-Api-Secret-Token")!==e.WEBHOOK_SECRET)
     return new Response("Forbidden",{status:403});

    const x=await r.json();

    if(x.channel_post)
     await index(e,x.channel_post);

    else if(x.callback_query)
     await cb(e,x.callback_query);

    else if(x.message?.text){
     const m=x.message;
     const t=m.text.trim();

     if(["/start","/menu","/games"].includes(t)){
      await say(e,m.chat.id,
       "مرحباً بك في <b>Adt Bot</b> ⚽",
       [[{text:"📚 تصفح الألعاب",callback_data:"home"}]]
      );
     }

     else if(t.startsWith("/search ")){
      const q=t.slice(8);

      const {results=[]}=await e.DB.prepare(
       "SELECT id,title,game,developer,version FROM posts WHERE title LIKE ? OR body LIKE ? LIMIT 15"
      ).bind(`%${q}%`,`%${q}%`).all();

      await say(e,m.chat.id,
       results.length?"نتائج البحث:":"لا توجد نتائج",
       results.map(x=>[{
        text:`${x.game} · ${x.developer} · ${x.version} — ${x.title}`.slice(0,60),
        callback_data:`p|${x.id}`
       }])
      );
     }

     else{
      await say(e,m.chat.id,"استخدم /menu أو /search كلمة");
     }
    }

    return new Response("OK");
   }

   if(u.pathname==="/admin")
    return h(ADMIN);

   if(u.pathname==="/api/admin/items")
    return admin(r,e);

   if(u.pathname==="/health")
    return j({ok:true});

   return new Response("Adt Bot is running");

  }catch(x){
   console.error(x);
   return j({error:"Internal error"},500);
  }
 }
};
