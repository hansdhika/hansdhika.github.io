const menu=document.getElementById("menu"),nav=document.getElementById("nav");
menu?.addEventListener("click",()=>nav.classList.toggle("open"));
document.querySelectorAll("#nav a").forEach(a=>a.addEventListener("click",()=>nav.classList.remove("open")));
const y=document.getElementById("year"); if(y)y.textContent=new Date().getFullYear();



// Tools dropdown
document.querySelectorAll(".nav-tools-toggle").forEach(function(btn){
  btn.addEventListener("click", function(e){
    e.preventDefault(); e.stopPropagation();
    var wrap=btn.closest(".nav-tools");
    var open=wrap.classList.toggle("open");
    btn.setAttribute("aria-expanded", open ? "true" : "false");
  });
});
document.addEventListener("click", function(e){
  document.querySelectorAll(".nav-tools.open").forEach(function(wrap){
    if(!wrap.contains(e.target)){
      wrap.classList.remove("open");
      var btn=wrap.querySelector(".nav-tools-toggle");
      if(btn) btn.setAttribute("aria-expanded","false");
    }
  });
});
