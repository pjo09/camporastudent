export function initTheme(){

    function getEl(id){
        return document.getElementById(id);
    }

    function applyTheme(){

        const theme = localStorage.getItem("theme") || "dark";

        document.body.classList.toggle("light", theme==="light");
        document.body.classList.toggle("dark", theme==="dark");

        const btn=getEl("themeToggle");

        if(btn){

            btn.textContent=theme==="dark" ? "🌙" : "☀️";

        }

    }

    function bindThemeToggle(){

        const btn=getEl("themeToggle");

        if(!btn) return;

        btn.addEventListener("click",()=>{

            const current=localStorage.getItem("theme")||"dark";

            const next=current==="dark"?"light":"dark";

            localStorage.setItem("theme",next);

            applyTheme();

        });

    }

    function ensureFooterYear(){

        const year=getEl("year");

        if(year){

            year.textContent=new Date().getFullYear();

        }

    }

    applyTheme();

    bindThemeToggle();

    ensureFooterYear();

}