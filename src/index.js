
const j=(x,s=200)=>new Response(JSON.stringify(x),{
 status:s,
 headers:{"content-type":"application/json"}
});

const h=(x,s=200)=>new Response(x,{
 status:s,
 headers:{"content-type":"text/html; charset=utf-8"}
});

async function api(e,m,p){
 const r=await fetch(
  `https://api.telegram.org/bot${e.BOT_TOKEN}/${m}`,
  {
   method:"POST",
   headers:{"content-type":"application/json"},
   body:JSON.stringify(p)
  }
 );
 return r.json();
}

async function say(e,c,t,k){
 return api(e,"sendMessage",{
  chat_id:c,
  text:t,
  parse_mode:"HTML",
  ...(k?{reply_markup:{inline_keyboard:k}}:{})
 });
}

async function init(e){
 await e.DB.prepare(`
  CREATE TABLE IF NOT EXISTS settings(
   key TEXT PRIMARY KEY,
   value TEXT NOT NULL
  )
 `).run();
}

async function getSetting(e,key,fallback){
 const x=await e.DB.prepare(
  "SELECT value FROM settings WHERE key=?"
 ).bind(key).first();

 return x?.value ?? fallback;
}

async function setSetting(e,key,value){
 await e.DB.prepare(`
  INSERT INTO settings(key,value)
  VALUES(?,?)
  ON CONFLICT(key) DO UPDATE SET value=excluded.value
 `).bind(key,value).run();
}

function meta(m){
 const b=[m.text,m.caption].filter(Boolean).join("\n");
 const l=b.toLowerCase();

 let game=
  /e[\s-]?football/i.test(b)?"eFootball":
  /pes\s*2021|pes21/i.test(b)?"PES 2021":
  /pes\s*2020|pes20/i.test(b)?"PES 2020":
  /pes\s*2017|pes17/i.test(b)?"PES 2017":
  /pes\s*2013|pes13/i.test(b)?"PES 2013":
  "غير محدد";

 let dev=
  ["nyan","luffy","ziru","efootxi","kipas"]
  .find(x=>l.includes(x))||"غير محدد";

 dev=({
  luffy:"LuffyDev",
  efootxi:"eFootXi"
 })[dev]||(
  dev==="غير محدد"?"غير محدد":
  dev[0].toUpperCase()+dev.slice(1)
 );

 const v=b.match(/\bv?\d+(?:\.\d+){0,3}\b/i);

 return {
  game,
  developer:dev,
  version:v?v[0]:"غير محدد",
  title:(b.split("\n").find(x=>x.trim())||"منشور القناة").slice(0,180),
  body:b.slice(0,4000)
 };
}

async function index(e,m){
 if(!m.chat?.id||!m.message_id)return;

 const x=meta(m);

 await e.DB.prepare(`
  INSERT INTO posts(
   chat_id,message_id,game,developer,version,title,body,created_at
  )
  VALUES(?,?,?,?,?,?,?,?)
  ON CONFLICT(chat_id,message_id) DO UPDATE SET
   game=excluded.game,
   developer=excluded.developer,
   version=excluded.version,
   title=excluded.title,
   body=excluded.body
 `).bind(
  String(m.chat.id),
  m.message_id,
  x.game,
  x.developer,
  x.version,
  x.title,
  x.body,
  m.date||Math.floor(Date.now()/1000)
 ).run();
}

async function menu(e,c){
 const {results=[]}=await e.DB.prepare(`
  SELECT game,COUNT(*) n
  FROM posts
  WHERE game!='Other'
  GROUP BY game
  ORDER BY game
 `).all();

 if(!results.length)
  return say(e,c,"لا توجد منشورات مفهرسة بعد.");

 const keys=results.map(x=>[{
  text:`${x.game} (${x.n})`,
  callback_data:`g|${encodeURIComponent(x.game)}`
 }]);

 return say(e,c,"اختر اللعبة:",keys);
}

async function cb(e,q){
 const c=q.message.chat.id;
 const p=q.data.split("|");

 await api(e,"answerCallbackQuery",{
  callback_query_id:q.id
 });

 if(p[0]==="home")
  return menu(e,c);

 if(p[0]==="g"){
  const game=decodeURIComponent(p[1]);

  const {results=[]}=await e.DB.prepare(`
   SELECT developer,COUNT(*) n
   FROM posts
   WHERE game=? AND developer!='Other'
   GROUP BY developer
   ORDER BY developer
  `).bind(game).all();

  const keys=results.map(x=>[{
   text:`${x.developer} (${x.n})`,
   callback_data:`d|${p[1]}|${encodeURIComponent(x.developer)}`
  }]);

  keys.push([{text:"↩ الألعاب",callback_data:"home"}]);

  return say(e,c,"اختر المطور:",keys);
 }

 if(p[0]==="d"){
  const game=decodeURIComponent(p[1]);
  const dev=decodeURIComponent(p[2]);

  const {results=[]}=await e.DB.prepare(`
   SELECT version,COUNT(*) n
   FROM posts
   WHERE game=? AND developer=? AND version!='Other'
   GROUP BY version
   ORDER BY version
  `).bind(game,dev).all();

  const keys=results.map(x=>[{
   text:`${x.version} (${x.n})`,
   callback_data:`v|${p[1]}|${p[2]}|${encodeURIComponent(x.version)}`
  }]);

  keys.push([{
   text:"↩ المطورون",
   callback_data:`g|${p[1]}`
  }]);

  return say(e,c,"اختر الإصدار:",keys);
 }

 if(p[0]==="v"){
  const vals=p.slice(1).map(decodeURIComponent);

  const {results=[]}=await e.DB.prepare(`
   SELECT id,title
   FROM posts
   WHERE game=? AND developer=? AND version=?
   ORDER BY created_at DESC
   LIMIT 25
  `).bind(...vals).all();

  const keys=results.map(x=>[{
   text:x.title.slice(0,60),
   callback_data:`p|${x.id}`
  }]);

  keys.push([{
   text:"↩ الإصدارات",
   callback_data:`d|${p[1]}|${p[2]}`
  }]);

  return say(e,c,"المنشورات:",keys);
 }

 if(p[0]==="p"){
  const x=await e.DB.prepare(`
   SELECT chat_id,message_id
   FROM posts
   WHERE id=?
  `).bind(+p[1]).first();

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
<title>Adt Bot Admin</title>

<style>
body{
 font:16px system-ui;
 background:#101827;
 color:#eef;
 padding:20px;
 max-width:900px;
 margin:auto
}
.card{
 background:#1d293b;
 padding:18px;
 border-radius:12px;
 margin:14px 0
}
input,textarea,button{
 box-sizing:border-box;
 width:100%;
 padding:12px;
 margin:6px 0;
 border-radius:7px;
 font:inherit
}
input,textarea{
 background:#0e1726;
 color:white;
 border:1px solid #567
}
textarea{
 min-height:100px;
 resize:vertical
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
.check{
 display:flex;
 align-items:center;
 gap:10px;
 margin:10px 0
}
.check input{
 width:auto
}
</style>

<h1>Adt Bot — لوحة الإدارة</h1>

<div class="card">
 <input id="pw" type="password" placeholder="كلمة مرور الإدارة">
 <button onclick="load()">دخول / تحديث</button>
 <p id="s"></p>
</div>

<div class="card">
 <h3>✉️ إعداد رسائل البوت</h3>

 <label>رسالة الترحيب</label>
 <textarea id="welcome"></textarea>

 <label>الرسالة الثانية</label>
 <textarea id="after"></textarea>

 <label>اسم زر تصفح الألعاب</label>
 <input id="buttonText" placeholder="مثال: 🎮 تصفح الألعاب">

 <label class="check">
  <input type="checkbox" id="buttonEnabled" checked>
  إظهار زر تصفح الألعاب
 </label>

 <button onclick="saveSettings()">حفظ الإعدادات</button>
 <small>يمكنك تغيير اسم الزر أو إخفاؤه في أي وقت.</small>
</div>

<div class="card">
 <h3>➕ إضافة إصدار جديد</h3>

 <input id="game" placeholder="اللعبة مثال: eFootball 27">
 <input id="dev" placeholder="المطور مثال: eFootXi">
 <input id="ver" placeholder="اسم الإصدار مثال: eFootXi 1.7">
 <input id="url" placeholder="رابط المنشور https://t.me/effotball_dz/481">

 <button onclick="add()">حفظ الإصدار</button>
</div>

<div class="card">
 <h3>المنشورات المضافة</h3>
 <div id="items"></div>
</div>

<script>
const $=x=>document.getElementById(x);

const headers=()=>({
 Authorization:"Bearer "+$("pw").value,
 "Content-Type":"application/json"
});

function safe(x){
 return String(x??"").replace(/[&<>"']/g,c=>({
  "&":"&amp;",
  "<":"&lt;",
  ">":"&gt;",
  '"':"&quot;",
  "'":"&#39;"
 }[c]));
}

async function load(){
 let r=await fetch("/api/admin/items",{
  headers:headers()
 });

 let d=await r.json();

 $("s").textContent=r.ok?"تم الاتصال":"خطأ "+r.status;

 if(!r.ok)return;

 $("items").innerHTML=(d.items||[]).map(x=>
  '<div class="item"><b>'+safe(x.title)+'</b><br>'+
  '<small>'+safe(x.game)+' / '+safe(x.developer)+
  ' / '+safe(x.version)+'</small><br>'+
  '<small>'+safe(x.chat_id)+' / '+x.message_id+
  '</small></div>'
 ).join("");

 let sr=await fetch("/api/admin/settings",{
  headers:headers()
 });

 let sd=await sr.json();

 if(sr.ok){
  $("welcome").value=sd.welcome||"";
  $("after").value=sd.after||"";
  $("buttonText").value=sd.button_text||"🎮 تصفح الألعاب";
  $("buttonEnabled").checked=sd.button_enabled!=="false";
 }
}

async function saveSettings(){
 let r=await fetch("/api/admin/settings",{
  method:"POST",
  headers:headers(),
  body:JSON.stringify({
   welcome:$("welcome").value,
   after:$("after").value,
   button_text:$("buttonText").value,
   button_enabled:$("buttonEnabled").checked
  })
 });

 let d=await r.json();

 $("s").textContent=r.ok?
  "تم حفظ الإعدادات بنجاح":
  "فشل الحفظ: "+(d.error||r.status);
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
  headers:headers(),
  body:JSON.stringify(b)
 });

 let d=await r.json();

 $("s").textContent=r.ok?
  "تم حفظ الإصدار بنجاح":
  (d.error||"فشل الحفظ");

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
  const {results=[]}=await e.DB.prepare(`
   SELECT id,chat_id,message_id,game,developer,version,title
   FROM posts
   WHERE game!='Other' AND developer!='Other' AND version!='Other'
   ORDER BY created_at DESC
   LIMIT 200
  `).all();

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

  const host=u.hostname.toLowerCase();

  const m=u.pathname.match(
   /^\/(?:s\/)?([A-Za-z0-9_]{5,32})\/(\d+)\/?$/
  );

  if(!["t.me","www.t.me","telegram.me","www.telegram.me"].includes(host)||!m){
   return j({
    error:"ضع رابط منشور من قناة عامة مثل https://t.me/effotball_dz/481"
   },400);
  }

  if(!x.game||!x.developer||!x.version){
   return j({error:"أكمل اللعبة والمطور واسم الإصدار"},400);
  }

  const chat="@"+m[1];
  const msg=+m[2];

  await e.DB.prepare(`
   INSERT INTO posts(
    chat_id,message_id,game,developer,version,title,body,created_at
   )
   VALUES(?,?,?,?,?,?,?,?)
   ON CONFLICT(chat_id,message_id) DO UPDATE SET
    game=excluded.game,
    developer=excluded.developer,
    version=excluded.version,
    title=excluded.title,
    body=excluded.body
  `).bind(
   chat,msg,
   x.game,x.developer,x.version,
   x.title||x.version,
   x.title||x.version,
   Math.floor(Date.now()/1000)
  ).run();

  return j({ok:true});
 }

 return j({error:"Method not allowed"},405);
}

async function settingsAPI(req,e){
 if(req.headers.get("Authorization")!==`Bearer ${e.ADMIN_PASSWORD}`)
  return j({error:"Unauthorized"},401);

 if(req.method==="GET"){
  return j({
   welcome:await getSetting(
    e,"welcome","مرحباً بك في <b>Adt Bot</b> ⚽"
   ),
   after:await getSetting(
    e,"after","اختر ما تريد تصفحه من الألعاب:"
   ),
   button_text:await getSetting(
    e,"button_text","🎮 تصفح الألعاب"
   ),
   button_enabled:await getSetting(
    e,"button_enabled","true"
   )
  });
 }

 if(req.method==="POST"){
  const x=await req.json();

  await setSetting(e,"welcome",String(x.welcome||""));
  await setSetting(e,"after",String(x.after||""));
  await setSetting(e,"button_text",String(x.button_text||"🎮 تصفح الألعاب"));
  await setSetting(e,"button_enabled",x.button_enabled?"true":"false");

  return j({ok:true});
 }

 return j({error:"Method not allowed"},405);
}

export default{
 async fetch(r,e){
  const u=new URL(r.url);

  try{
   await init(e);

   if(u.pathname==="/telegram/webhook"&&r.method==="POST"){
    if(
     r.headers.get("X-Telegram-Bot-Api-Secret-Token")!==e.WEBHOOK_SECRET
    ){
     return new Response("Forbidden",{status:403});
    }

    const x=await r.json();

    if(x.channel_post){
     await index(e,x.channel_post);
    }

    else if(x.edited_channel_post){
     await index(e,x.edited_channel_post);
    }

    else if(x.callback_query){
     await cb(e,x.callback_query);
    }

    else if(x.message?.text){
     const m=x.message;
     const t=m.text.trim();

     if(["/start","/menu","/games"].includes(t)){
      const welcome=await getSetting(
       e,"welcome","مرحباً بك في <b>Adt Bot</b> ⚽"
      );

      const after=await getSetting(
       e,"after","اختر ما تريد تصفحه من الألعاب:"
      );

      const buttonText=await getSetting(
       e,"button_text","🎮 تصفح الألعاب"
      );

      const enabled=await getSetting(
       e,"button_enabled","true"
      );

      await say(e,m.chat.id,welcome);

      const keyboard=enabled==="true"?
       [[{
        text:buttonText,
        callback_data:"home"
       }]]:
       undefined;

      await say(e,m.chat.id,after,keyboard);
     }

     else if(t==="/search"||t.startsWith("/search ")){
      const q=t.slice(7).trim();

      if(!q){
       await say(e,m.chat.id,"اكتب كلمة البحث بعد الأمر /search");
      }else{
       const {results=[]}=await e.DB.prepare(`
        SELECT id,title,game,developer,version
        FROM posts
        WHERE game!='Other'
        AND developer!='Other'
        AND version!='Other'
        AND (title LIKE ? OR body LIKE ?)
        LIMIT 15
       `).bind(`%${q}%`,`%${q}%`).all();

       const keys=results.map(x=>[{
        text:`${x.game} · ${x.developer} · ${x.version} — ${x.title}`.slice(0,60),
        callback_data:`p|${x.id}`
       }]);

       await say(
        e,m.chat.id,
        results.length?"نتائج البحث:":"لا توجد نتائج",
        keys.length?keys:undefined
       );
      }
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

   if(u.pathname==="/api/admin/settings")
    return settingsAPI(r,e);

   if(u.pathname==="/health")
    return j({ok:true});

   return new Response("Adt Bot is running");

  }catch(x){
   console.error(x);
   return j({error:"Internal error"},500);
  }
 }
};
