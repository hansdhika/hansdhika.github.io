const menu=document.getElementById("menu"),nav=document.getElementById("nav");
menu?.addEventListener("click",()=>nav.classList.toggle("open"));
document.querySelectorAll("#nav a").forEach(a=>a.addEventListener("click",()=>nav.classList.remove("open")));
const y=document.getElementById("year"); if(y)y.textContent=new Date().getFullYear();


document.querySelectorAll(".nav-tools-toggle").forEach(btn => {
  btn.addEventListener("click", e => {
    e.stopPropagation();
    const wrap = btn.closest(".nav-tools");
    const isOpen = wrap.classList.toggle("open");
    btn.setAttribute("aria-expanded", String(isOpen));
  });
});

document.addEventListener("click", e => {
  document.querySelectorAll(".nav-tools.open").forEach(wrap => {
    if (!wrap.contains(e.target)) {
      wrap.classList.remove("open");
      const btn = wrap.querySelector(".nav-tools-toggle");
      if (btn) btn.setAttribute("aria-expanded", "false");
    }
  });
});

document.querySelectorAll(".nav-tools-menu a").forEach(a => {
  a.addEventListener("click", () => {
    const wrap = a.closest(".nav-tools");
    wrap?.classList.remove("open");
    wrap?.querySelector(".nav-tools-toggle")?.setAttribute("aria-expanded", "false");
  });
});
