const API='';let token=localStorage.token||'',me=null,current=null;const $=s=>document.querySelector(s);const A=[...Array(101)].map((_,i)=>i);const roles=['طبيب','ممرض','تخدير','معالج فيزيائي','طبيب أسنان','تحليلات'];
const meds={
'أدوية الجهاز الهضمي':['Rennie — الحموضة','Omeprazole 20 mg','Omeprazole 40 mg','Esomeprazole 20 mg','Esomeprazole 40 mg','Buscopan 10 mg','Flagyl 250 mg','Flagyl 500 mg','Plasil 10 mg','No Vomit 8 mg','Enterostop Tab','Colona Tab','Duspatalin 135 mg','Cinnarizine 25 mg'],
'المضادات الحيوية':['Amoxicillin 500 mg','Augmentin 625 mg','Azithromycin 500 mg','Cefixime 400 mg','Ciprofloxacin 500 mg','Metronidazole 500 mg'],
'الحساسية والزكام':['Loratadine 10 mg','Cetirizine 10 mg','Paracetamol 500 mg','Vitamin C','Nasal drops'],
'السكري والضغط':['Metformin 500 mg','Amlodipine 5 mg','Captopril 25 mg','Losartan 50 mg'],
'المسكنات ومضادات الالتهاب':['Paracetamol 1G','Ibuprofen 400 mg','Diclofenac 50 mg','Aspirin 100 mg'],
'الكريمات والمراهم':['Fucidin cream','Betadine','Burn cream','Hydrocortisone cream'],
'القطرات والمستلزمات':['Normal saline','Gauze','Syringe','Gloves','Alcohol swab']
};
async function api(p,o={}){o.headers={'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})};let r=await fetch(API+p,o);let j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.message||'خطأ');return j}
function logo(){return `<div class="logos"><div class="logoBox mLogo"><div class="mn">M<small>NEXUS</small></div></div><div class="logoBox teamLogo"><img src="/assets/team-logo.png"></div></div>`}
function login(){document.body.className='loginPage';document.body.innerHTML='<div id="app"></div>';$('#app').innerHTML=`<div class="loginShell"><div class="loginHeroLogo"><img src="/assets/team-logo.png" alt="فريق انترين الطبي"></div><div class="login card"><div class="welcome">أهلاً بك في</div><h1>فريق انترين الطبي</h1><div class="goldLine"></div><label>البريد الإلكتروني</label><input id="email" placeholder="ادخل البريد الإلكتروني"><label>كلمة المرور</label><input id="pass" type="password" placeholder="ادخل كلمة المرور"><div id="err"></div><button class="btn loginBtn" onclick="doLogin()">تسجيل الدخول</button><button class="forgot" type="button">نسيت كلمة المرور؟</button></div></div>`}
async function doLogin(){try{let r=await api('/api/login',{method:'POST',body:JSON.stringify({email:$('#email').value,password:$('#pass').value})});token=r.token;localStorage.token=token;me=r.user;home()}catch(e){$('#err').innerHTML=`<div class="danger btn" style="width:100%;margin:12px 0">${e.message}</div>`}}
async function loadMe(){try{me=await api('/api/me');if(!me)throw 0;home()}catch{login()}}
function shell(view){document.body.className='appPage';$('#app').innerHTML=`<div class="wrap"><div class="top"><div>${logo()}<h1>الملف الطبي للزوار</h1><b>فريق انترين الطبي — M-Nexus</b></div><div class="nav"><button onclick="home()">الرئيسية</button><button onclick="archive()">الأرشيف</button><button onclick="users()">إدارة المستخدمين</button><button onclick="localStorage.clear();login()">خروج</button></div></div><div id="view">${view}</div></div>`}
async function home(){let s=await api('/api/stats');shell(`<div class="grid cols"><div><div class="grid" style="grid-template-columns:repeat(3,1fr)"><div class="card"><div class="stat">${s.patients}</div>الزوار المسجلين</div><div class="card"><div class="stat">${s.users}</div>المستخدمين</div><div class="card"><div class="stat">M</div>M- nexus</div></div><div class="card empty"><div>لا يتم عرض المرضى في الرئيسية<br><small>اضغط الأرشيف أو عرض كل السجلات للبحث والاستعراض.</small><br><br><button class="btn" onclick="archive()">فتح الأرشيف 📂</button></div></div></div><div class="card">${patientForm()}</div></div>`)}
function patientForm(){return `<h2>إضافة زائر / مريض +</h2><label>الاسم الكامل</label><input id="pname"><label>الهاتف</label><input id="pphone"><label>العمر</label><select id="page"><option value="">اختر العمر</option>${A.map(x=>`<option>${x}</option>`).join('')}</select><label>الجنس</label><select id="pgender"><option>ذكر</option><option>أنثى</option></select><label>العنوان</label><input id="paddr"><label>ملاحظات</label><textarea id="pnotes"></textarea><div id="msg"></div><button class="btn" onclick="savePatient()">حفظ الملف</button>`}
async function savePatient(){try{let p=await api('/api/patients',{method:'POST',body:JSON.stringify({name:$('#pname').value,phone:$('#pphone').value,age:$('#page').value,gender:$('#pgender').value,address:$('#paddr').value,notes:$('#pnotes').value})});current=p;openPatient(p.id,true)}catch(e){$('#msg').innerHTML=`<div class="danger btn" style="margin:12px 0">${e.message}</div>`}}
async function archive(){shell(`<h1>الأرشيف الطبي 📂</h1><div class="card"><input id="q" placeholder="ابحث بالاسم أو الهاتف أو العنوان"><button class="btn" onclick="search()">بحث 🔍</button><button class="btn" onclick="search(true)">عرض كل السجلات 📂</button><div id="results"></div></div>`);search(true)}
async function search(all=false){let q=all?'':($('#q')?.value||'');let arr=await api('/api/archive?q='+encodeURIComponent(q));$('#results').innerHTML=arr.map(p=>`<div class="patientRow"><div><b>${p.name}</b><br>العمر: ${p.age} · ${p.gender} · الهاتف: ${p.phone}<br>زيارات: ${p.visits.length} · وصفات: ${p.prescriptions.length}</div><button class="btn" onclick="openPatient(${p.id})">فتح الملف</button><button class="btn danger" onclick="delPatient(${p.id})">حذف</button></div>`).join('')||'<p>لا توجد سجلات</p>'}
async function delPatient(id){if(confirm('حذف المريض وكل سجله؟')){await api('/api/patients/'+id,{method:'DELETE'});search(true)}}
async function openPatient(id,newOne=false){let p=await api('/api/patients/'+id+'/full');current=p;shell(`<h1>الملف الكامل: ${p.name}</h1><p>العمر ${p.age} · ${p.gender} · الهاتف ${p.phone}</p><div class="grid cols"><div class="card medical">${visitForm()}</div><div class="card medical">${rxForm()}</div></div><div class="card medical saveAllBox"><button class="btn saveAllBtn" onclick="saveAll()">حفظ الزيارة والوصفة والرجوع للرئيسية</button><div id="saveAllMsg"></div></div><div class="card medical"><h2>السجل والتاريخ والوقت</h2><div id="history">${history(p)}</div></div>`)}
function visitForm(){return `<h2>العلامات الحيوية والزيارة</h2><div class="vitals"><label>BP الضغط<input id="bp" placeholder="mmHg"></label><label>Pulse النبض<input id="pulse" placeholder="bpm / دقيقة"></label><label>الحرارة<input id="temp" placeholder="C°"></label><label>الأوكسجين<input id="o2" placeholder="%"></label><label>السكر<input id="bg" placeholder="mg/dL"></label></div><label>الشكوى</label><textarea id="complaint"></textarea><label>التشخيص / الحالة المرضية</label><textarea id="diagnosis"></textarea><label>الإجراء / شنو سويت</label><textarea id="procedure"></textarea><label>العلاج</label><textarea id="treatment"></textarea>`}
function rxForm(){return `<h2>اختيار الأدوية</h2><div class="medCats">${Object.entries(meds).map(([k,arr],i)=>`<details class="cat" ${i==0?'open':''}><summary>${k}</summary><div class="medList">${arr.map(m=>`<label class="medItem"><span>${m}</span><input type="checkbox" value="${m}" class="med"></label>`).join('')}</div></details>`).join('')}</div><label>ملاحظات الوصفة</label><textarea id="rxnotes"></textarea>`}

async function saveAll(){
  try{
    const visit={
      bp:$('#bp')?.value||'',pulse:$('#pulse')?.value||'',temp:$('#temp')?.value||'',o2:$('#o2')?.value||'',bg:$('#bg')?.value||'',
      complaint:$('#complaint')?.value||'',diagnosis:$('#diagnosis')?.value||'',procedure:$('#procedure')?.value||'',treatment:$('#treatment')?.value||''
    };
    const medicines=[...document.querySelectorAll('.med:checked')].map(x=>x.value);
    const notes=$('#rxnotes')?.value||'';
    const hasVisit=Object.values(visit).some(v=>String(v).trim());
    const hasRx=medicines.length>0 || notes.trim();
    if(hasVisit){
      await api(`/api/patients/${current.id}/visits`,{method:'POST',body:JSON.stringify(visit)});
    }
    if(hasRx){
      await api(`/api/patients/${current.id}/prescriptions`,{method:'POST',body:JSON.stringify({medicines,notes})});
    }
    if(!hasVisit && !hasRx){
      $('#saveAllMsg').innerHTML='<div class="danger btn" style="margin:12px 0">اكتب بيانات الزيارة أو اختار أدوية قبل الحفظ</div>';
      return;
    }
    home();
  }catch(e){
    $('#saveAllMsg').innerHTML=`<div class="danger btn" style="margin:12px 0">${e.message}</div>`;
  }
}

async function saveVisit(){await api(`/api/patients/${current.id}/visits`,{method:'POST',body:JSON.stringify({bp:$('#bp').value,pulse:$('#pulse').value,temp:$('#temp').value,o2:$('#o2').value,bg:$('#bg').value,complaint:$('#complaint').value,diagnosis:$('#diagnosis').value,procedure:$('#procedure').value,treatment:$('#treatment').value})});home()}
async function saveRx(){let medicines=[...document.querySelectorAll('.med:checked')].map(x=>x.value);await api(`/api/patients/${current.id}/prescriptions`,{method:'POST',body:JSON.stringify({medicines,notes:$('#rxnotes').value})});home()}
function history(p){let v=p.visits.map(x=>`<div class="record"><b>زيارة: ${new Date(x.createdAt).toLocaleString('ar-IQ')}</b><br>بواسطة: ${x.provider} - ${x.specialty}<br>BP ${x.bp} mmHg | Pulse ${x.pulse} bpm | O2 ${x.o2}% | T ${x.temp} C° | BG ${x.bg} mg/dL<br>تشخيص: ${x.diagnosis||'-'}<br>إجراء: ${x.procedure||'-'}<br>علاج: ${x.treatment||'-'}</div>`).join('');let r=p.prescriptions.map(x=>`<div class="record"><b>وصفة: ${new Date(x.createdAt).toLocaleString('ar-IQ')}</b><br>بواسطة: ${x.provider} - ${x.specialty}<br>${x.medicines.join('، ')}<br>${x.notes||''}</div>`).join('');return v+r||'لا يوجد سجل بعد'}
async function users(){let arr=await api('/api/users');shell(`<h1>إدارة المستخدمين</h1><div class="card"><div class="grid" style="grid-template-columns:repeat(5,1fr)"><input id="un" placeholder="الاسم"><input id="ue" placeholder="البريد"><input id="up" placeholder="كلمة المرور"><select id="ur">${roles.map(r=>`<option>${r}</option>`)}</select><button class="btn" onclick="addUser()">إضافة</button></div>${arr.map(u=>`<div class="patientRow"><b>${u.name}</b><span>${u.email}</span><span>${u.role} - ${u.specialty}</span></div>`).join('')}</div>`)}
async function addUser(){await api('/api/users',{method:'POST',body:JSON.stringify({name:$('#un').value,email:$('#ue').value,password:$('#up').value,role:$('#ur').value,specialty:$('#ur').value})});users()}
loadMe();
