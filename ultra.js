(function () {
'use strict';

/* ================== STYLE ================== */

function injectStyles(){
    if(document.getElementById('ultra-style')) return;

    var style = document.createElement('style');
    style.id = 'ultra-style';
    style.textContent = `
    .button--ultra{
        background: linear-gradient(135deg,#0057B7,#FFD700) !important;
        color:#fff !important;
        font-weight:700;
        border-radius:12px;
        display:flex;
        align-items:center;
        justify-content:center;
        height:3.5em;
        width:100%;
        margin-bottom:10px;
        cursor:pointer;
    }

    .ultra-panel{
        position:fixed;
        right:20px;
        top:120px;
        width:340px;
        max-height:70vh;
        overflow:auto;
        background:rgba(0,0,0,0.92);
        border-radius:12px;
        padding:10px;
        z-index:999999;
        color:#fff;
    }

    .ultra-item{
        padding:10px;
        margin-bottom:6px;
        border-radius:10px;
        background:rgba(255,255,255,0.06);
        cursor:pointer;
    }

    .ultra-item:hover{
        background:rgba(255,255,255,0.12);
    }

    .ultra-title{
        font-size:14px;
        white-space:nowrap;
        overflow:hidden;
        text-overflow:ellipsis;
    }
    `;
    document.head.appendChild(style);
}

/* ================== PANEL ================== */

var panel;
var opened = false;

function createPanel(){
    panel = document.createElement('div');
    panel.className = 'ultra-panel';
    panel.style.display = 'none';
    document.body.appendChild(panel);
}

/* ================== DATA ================== */

function loadContent(){

    try{
        var active = Lampa.Activity.active();
        if(!active || !active.movie) return;
    } catch(e){
        return;
    }

    var movie = active.movie;
    var id = movie.kinopoisk_id || movie.id;

    var url = 'https://ab2024.ru/lite/events?id=' + id;

    var req = new Lampa.Reguest();

    panel.innerHTML = 'Loading...';
    panel.style.display = 'block';

    req.silent(url, function(json){

        panel.innerHTML = '';

        var list = json && json.online ? json.online : [];

        if(!list.length){
            panel.innerHTML = 'No results';
            return;
        }

        list.forEach(function(item){

            var el = document.createElement('div');
            el.className = 'ultra-item';
            el.innerHTML = '<div class="ultra-title">'+(item.title||'No title')+'</div>';

            el.onclick = function(){
                try{
                    Lampa.Player.play(item);
                }catch(e){}
            };

            panel.appendChild(el);
        });

    }, function(){
        panel.innerHTML = 'Error';
    });
}

/* ================== BUTTON (SKAZ STYLE) ================== */

function addButton(){

    var container =
        document.querySelector('.full-start__buttons') ||
        document.querySelector('.full__buttons') ||
        document.querySelector('.full-details__buttons') ||
        document.body;

    if(!container) return;

    if(container.querySelector('.button--ultra')) return;

    var btn = document.createElement('div');
    btn.className = 'button--ultra selector';
    btn.innerText = 'ULTRA SEARCH';

    btn.onclick = function(){

        if(!opened){
            loadContent();
            opened = true;
        } else {
            if(panel.style.display === 'none'){
                panel.style.display = 'block';
            } else {
                panel.style.display = 'none';
            }
        }
    };

    container.prepend(btn);
}

/* ================== INIT (NO LAMPA EVENTS) ================== */

function boot(){

    injectStyles();
    createPanel();

    // 🔥 skaz-style polling (главный секрет стабильности)
    setInterval(function(){
        addButton();
    }, 800);
}

/* ================== START ================== */

document.addEventListener('DOMContentLoaded', boot);
setTimeout(boot, 1500);
setTimeout(boot, 3000);

})();
