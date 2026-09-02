const menu=document.getElementById("menu"),nav=document.getElementById("nav");
menu?.addEventListener("click",()=>nav.classList.toggle("open"));
document.querySelectorAll("#nav a").forEach(a=>a.addEventListener("click",()=>nav.classList.remove("open")));
const y=document.getElementById("year"); if(y)y.textContent=new Date().getFullYear();
