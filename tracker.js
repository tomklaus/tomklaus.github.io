(function () {
    'use strict';

    var TAG       = 'ua_tracker';
    var STORE_KEY = 'ua_tracker_v3';
    var TMDB_KEY  = '4ef0d7355d9ffb5151e987764708ce96';
    var TMDB_BASE = 'https://api.themoviedb.org/3';
    var IMG_BASE  = 'https://image.tmdb.org/t/p/w92';

    // ============================================================
    // БЕЗПЕЧНІ УТИЛІТИ
    // ============================================================
    function esc(str) {
        try {
            return String(str || '')
                .replace(/&/g,'&amp;')
                .replace(/</g,'&lt;')
                .replace(/>/g,'&gt;')
                .replace(/"/g,'&quot;');
        } catch(e) { return ''; }
    }

    function pad(n) {
        return String(n || 0).padStart(2, '0');
    }

    function log(msg, err) {
        try { console.log('[UA-Tracker] ' + msg, err || ''); } catch(e){}
    }

    // ============================================================
    // СХОВИЩЕ
    // ============================================================
    var Store = {
        get: function () {
            try {
                var raw = Lampa.Storage.get(STORE_KEY, 'false');
                return JSON.parse(raw) || {};
            } catch(e) { return {}; }
        },
        set: function (data) {
            try { Lampa.Storage.set(STORE_KEY, JSON.stringify(data)); } catch(e){}
        },
        getShow: function (id) {
            try { return this.get()[String(id)] || null; } catch(e) { return null; }
        },
        setShow: function (show) {
            try {
                var data = this.get();
                data[String(show.id)] = show;
                this.set(data);
            } catch(e) { log('setShow error', e); }
        },
        removeShow: function (id) {
            try {
                var data = this.get();
                delete data[String(id)];
                this.set(data);
            } catch(e){}
        },
        all: function () {
            try {
                var data = this.get();
                return Object.keys(data).map(function(k){ return data[k]; });
            } catch(e) { return []; }
        }
    };

    // ============================================================
    // TMDB ЗАПИТИ
    // ============================================================
    function tmdbGet(path, onOk, onFail) {
        try {
            var sep = path.indexOf('?') >= 0 ? '&' : '?';
            var url = TMDB_BASE + path + sep
                    + 'api_key=' + TMDB_KEY
                    + '&language=uk-UA';
            $.ajax({
                url:      url,
                type:     'GET',
                dataType: 'json',
                timeout:  10000,
                success:  function(d){ try{ onOk(d); }catch(e){ log('tmdb cb err',e); } },
                error:    function(){ try{ if(onFail) onFail(); }catch(e){} }
            });
        } catch(e) {
            log('tmdbGet error', e);
            if (onFail) try{ onFail(); }catch(_){}
        }
    }

    function fetchUnwatched(show, callback) {
        try {
            var today = new Date().toISOString().slice(0, 10);
            tmdbGet('/tv/' + show.id, function (info) {
                try {
                    var seasons = (info.seasons || []).filter(function(s){
                        return s.season_number > 0;
                    });
                    if (!seasons.length) { callback([]); return; }

                    var results = [];
                    var left    = seasons.length;

                    seasons.forEach(function (s) {
                        tmdbGet('/tv/' + show.id + '/season/' + s.season_number,
                        function (sd) {
                            try {
                                (sd.episodes || []).forEach(function (ep) {
                                    try {
                                        if (!ep.air_date || ep.air_date > today) return;
                                        var key = 's' + ep.season_number + 'e' + ep.episode_number;
                                        if (show.watched && show.watched[key]) return;
                                        var sn = ep.season_number;
                                        var en = ep.episode_number;
                                        var ls = show.last_season  || 0;
                                        var le = show.last_episode || 0;
                                        var isNew = (sn > ls) || (sn === ls && en > le);
                                        if (isNew) {
                                            results.push({
                                                key:     key,
                                                season:  sn,
                                                episode: en,
                                                title:   ep.name || ('Серія ' + en),
                                                date:    ep.air_date
                                            });
                                        }
                                    } catch(e){}
                                });
                            } catch(e){}
                            if (--left === 0) callback(results);
                        },
                        function(){ if (--left === 0) callback(results); });
                    });
                } catch(e) { log('fetchUnwatched inner',e); callback([]); }
            },
            function(){ callback([]); });
        } catch(e) { log('fetchUnwatched',e); callback([]); }
    }

    // ============================================================
    // ВІДМІТИТИ ПЕРЕГЛЯНУТОЮ
    // ============================================================
    function markWatched(showId, season, episode, voice) {
        try {
            var show = Store.getShow(showId);
            if (!show) return;
            var key = 's' + season + 'e' + episode;
            show.watched          = show.watched || {};
            show.watched[key]     = true;
            if (season > (show.last_season || 0)) {
                show.last_season  = season;
                show.last_episode = episode;
            } else if (season === (show.last_season || 0) &&
                       episode > (show.last_episode || 0)) {
                show.last_episode = episode;
            }
            if (voice) show.voice = voice;
            show.unwatched = (show.unwatched || []).filter(function(e){
                return e.key !== key;
            });
            Store.setShow(show);
        } catch(e) { log('markWatched',e); }
    }

    // ============================================================
    // ПЕРЕВІРКА ВСІХ СЕРІАЛІВ
    // ============================================================
    function checkAll(notify) {
        try {
            Store.all().forEach(function (show) {
                fetchUnwatched(show, function (eps) {
                    try {
                        if (!eps.length) return;
                        var stored = Store.getShow(show.id);
                        if (!stored) return;
                        var existing = (stored.unwatched || []).map(function(e){ return e.key; });
                        var added = 0;
                        eps.forEach(function (ep) {
                            if (existing.indexOf(ep.key) < 0) {
                                stored.unwatched = stored.unwatched || [];
                                stored.unwatched.push(ep);
                                added++;
                            }
                        });
                        if (added > 0) {
                            Store.setShow(stored);
                            if (notify) {
                                Lampa.Noty.show(
                                    '📺 ' + stored.title + ': +' + added +
                                    (added === 1 ? ' нова серія' : ' нових серій') +
                                    (stored.voice ? '  🎙 ' + stored.voice : '')
                                );
                            }
                        }
                    } catch(e){ log('checkAll cb',e); }
                });
            });
        } catch(e){ log('checkAll',e); }
    }

    // ============================================================
    // СТИЛІ
    // ============================================================
    function injectCSS() {
        try {
            if (document.getElementById('ua-trk-css')) return;
            var s  = document.createElement('style');
            s.id   = 'ua-trk-css';
            s.textContent = [
                '.trk{padding:1.4em 2em;color:#fff;overflow-y:auto;height:100%;box-sizing:border-box}',
                '.trk h1{font-size:1.6em;margin:0 0 .2em}',
                '.trk p{color:#999;font-size:.9em;margin:0 0 1.2em}',
                '.trk-btn{display:inline-block;border:none;padding:.45em 1.3em;',
                '  border-radius:.4em;cursor:pointer;font-size:.9em;',
                '  font-weight:700;margin:0 .4em .5em 0}',
                '.trk-btn.yellow{background:#e5a00d;color:#000}',
                '.trk-btn.yellow:hover,.trk-btn.yellow.focus{background:#ffb829}',
                '.trk-empty{text-align:center;margin-top:4em;color:#777;font-size:1.1em;line-height:2}',
                '.trk-show{margin-bottom:1.8em;border-left:3px solid #e5a00d;padding-left:1em}',
                '.trk-show-h{display:flex;align-items:center;gap:.7em;margin-bottom:.6em}',
                '.trk-show-h img{height:3em;border-radius:.3em;flex-shrink:0}',
                '.trk-show-name{font-size:1.05em;font-weight:700}',
                '.trk-show-voice{font-size:.8em;color:#e5a00d;margin-top:.15em}',
                '.trk-ep{display:flex;align-items:center;gap:.6em;background:rgba(255,255,255,.06);',
                '  border-radius:.4em;padding:.4em .8em;margin-bottom:.3em}',
                '.trk-ep:focus,.trk-ep.focus{background:rgba(255,255,255,.2);outline:none}',
                '.trk-ep-n{color:#e5a00d;font-weight:700;min-width:5em;font-size:.9em}',
                '.trk-ep-t{flex:1;font-size:.9em}',
                '.trk-ep-d{color:#666;font-size:.8em;white-space:nowrap}',
                '.trk-ep-ok{background:none;border:1px solid #444;color:#5f5;padding:.2em .55em;',
                '  border-radius:.3em;cursor:pointer;font-size:.8em;white-space:nowrap}',
                '.trk-ep-ok:hover{background:#5f5;color:#000}',
                // кнопка "Стежити" на сторінці серіалу
                '.trk-follow-btn{margin-top:.6em !important}'
            ].join('');
            document.head.appendChild(s);
        } catch(e){ log('injectCSS',e); }
    }

    // ============================================================
    // КОМПОНЕНТ — СТОРІНКА ТРЕКЕРА
    // ============================================================
    function TrackerPage(object) {
        this._obj  = object;
        this._html = $('<div class="trk"></div>');
    }

    TrackerPage.prototype = {
        create: function () {
            try {
                injectCSS();
                this._build();
            } catch(e){ log('TrackerPage.create',e); }
        },
        render:  function () { return this._html; },
        start:   function () {
            try {
                var html = this._html;
                Lampa.Controller.add(TAG, {
                    toggle: function () {
                        Lampa.Controller.collectionSet(html);
                        Lampa.Controller.collectionFocus(false, html);
                    },
                    up:   function () { Lampa.Controller.collectionUp(); },
                    down: function () { Lampa.Controller.collectionDown(); },
                    back: function () { Lampa.Activity.backward(); }
                });
                Lampa.Controller.toggle(TAG);
            } catch(e){ log('TrackerPage.start',e); }
        },
        pause:   function () {},
        stop:    function () {},
        destroy: function () { try{ this._html.remove(); }catch(e){} },

        _build: function () {
            try {
                var self = this;
                var w    = this._html.empty();

                w.append('<h1>📺 Трекер серіалів</h1>');
                w.append('<p>Всі непереглянуті серії в одному місці</p>');

                var refresh = $('<button class="trk-btn yellow selector">🔄 Перевірити нові серії</button>');
                refresh.on('click hover:enter', function () {
                    try {
                        Lampa.Noty.show('Перевіряю нові серії…');
                        checkAll(true);
                        setTimeout(function(){ try{ self._build(); }catch(e){} }, 5000);
                    } catch(e){}
                });
                w.append(refresh);

                var shows = Store.all().filter(function(s){
                    return s && s.unwatched && s.unwatched.length > 0;
                });

                if (!shows.length) {
                    w.append(
                        '<div class="trk-empty">' +
                        '🎉 Непереглянутих серій немає!<br>' +
                        '<small>Відкрийте серіал і натисніть<br><b>＋ Стежити</b></small>' +
                        '</div>'
                    );
                    return;
                }

                shows.forEach(function (show) {
                    try {
                        var block = $('<div class="trk-show"></div>');

                        // заголовок
                        var head = $('<div class="trk-show-h"></div>');
                        if (show.poster) {
                            head.append('<img src="' + IMG_BASE + esc(show.poster) + '" alt="">');
                        }
                        var inf = $('<div></div>');
                        inf.append('<div class="trk-show-name">' + esc(show.title) + '</div>');
                        if (show.voice) {
                            inf.append('<div class="trk-show-voice">🎙 ' + esc(show.voice) + '</div>');
                        }
                        head.append(inf);
                        block.append(head);

                        // серії
                        var sorted = (show.unwatched || []).slice().sort(function(a,b){
                            return a.season !== b.season
                                ? a.season - b.season
                                : a.episode - b.episode;
                        });

                        sorted.forEach(function (ep) {
                            try {
                                var row = $(
                                    '<div class="trk-ep selector" tabindex="0">' +
                                    '<span class="trk-ep-n">S' + pad(ep.season) +
                                        'E' + pad(ep.episode) + '</span>' +
                                    '<span class="trk-ep-t">' + esc(ep.title) + '</span>' +
                                    '<span class="trk-ep-d">' + esc(ep.date)  + '</span>' +
                                    '<button class="trk-ep-ok selector">✓ Переглянуто</button>' +
                                    '</div>'
                                );
                                row.find('.trk-ep-ok').on('click hover:enter', function(ev){
                                    try {
                                        ev.stopPropagation();
                                        markWatched(show.id, ep.season, ep.episode, show.voice);
                                        row.fadeOut(200, function(){ row.remove(); });
                                        Lampa.Noty.show('✓ Відмічено як переглянуте');
                                    } catch(e){}
                                });
                                block.append(row);
                            } catch(e){ log('ep row',e); }
                        });

                        w.append(block);
                    } catch(e){ log('show block',e); }
                });
            } catch(e){ log('TrackerPage._build',e); }
        }
    };

    Lampa.Component.add(TAG, TrackerPage);

    // ============================================================
    // КНОПКА В ГОЛОВНОМУ МЕНЮ
    // ============================================================
    function addMenuBtn() {
        try {
            Lampa.Listener.follow('menu', function (e) {
                try {
                    if (e.type !== 'build') return;

                    var total = Store.all().reduce(function(n,s){
                        return n + ((s.unwatched && s.unwatched.length) || 0);
                    }, 0);

                    var badge = total
                        ? ' <sup style="background:#e55;border-radius:1em;padding:.05em .45em;font-size:.7em">'
                          + total + '</sup>'
                        : '';

                    var item = $(
                        '<li class="menu__item selector">' +
                        '<div class="menu__ico">📺</div>' +
                        '<div class="menu__text">Трекер' + badge + '</div>' +
                        '</li>'
                    );

                    item.on('hover:enter', function () {
                        try {
                            Lampa.Activity.push({
                                title:     'Трекер серіалів',
                                component: TAG,
                                page:      1
                            });
                        } catch(e){ log('menu push',e); }
                    });

                    e.render.find('.menu__list').first().append(item);
                } catch(e){ log('menu build',e); }
            });
        } catch(e){ log('addMenuBtn',e); }
    }

    // ============================================================
    // КНОПКА "СТЕЖИТИ" НА СТОРІНЦІ СЕРІАЛУ
    // ============================================================
    function addFollowBtn() {
        try {
            Lampa.Listener.follow('full', function (e) {
                // !! Критично: весь код у try-catch !!
                try {
                    if (e.type !== 'complite') return;

                    var movie = {};
                    try { movie = (e.data && e.data.movie) || e.movie || {}; } catch(_){}

                    // тільки серіали (є first_air_date або number_of_seasons)
                    if (!movie || !movie.id) return;
                    var isTv = movie.media_type === 'tv'
                            || typeof movie.first_air_date !== 'undefined'
                            || typeof movie.number_of_seasons !== 'undefined';
                    if (!isTv) return;

                    var id      = movie.id;
                    var tracked = !!Store.getShow(id);

                    var btn = $(
                        '<button class="full-start__button selector trk-follow-btn">' +
                        (tracked ? '📺 Відстежується' : '＋ Стежити') +
                        '</button>'
                    );
                    if (tracked) btn.css('background', '#27ae60');

                    btn.on('hover:enter click', function () {
                        try {
                            if (Store.getShow(id)) {
                                Store.removeShow(id);
                                btn.text('＋ Стежити').css('background','');
                                Lampa.Noty.show('Серіал видалено з відстеження');
                            } else {
                                var show = {
                                    id:           id,
                                    title:        movie.name || movie.title || String(id),
                                    poster:       movie.poster_path || '',
                                    voice:        '',
                                    watched:      {},
                                    unwatched:    [],
                                    last_season:  0,
                                    last_episode: 0
                                };
                                Store.setShow(show);
                                btn.text('📺 Відстежується').css('background','#27ae60');
                                Lampa.Noty.show('Додано! Шукаю непереглянуті серії…');
                                fetchUnwatched(show, function (eps) {
                                    try {
                                        var s = Store.getShow(id);
                                        if (!s) return;
                                        s.unwatched = eps;
                                        Store.setShow(s);
                                        if (eps.length) {
                                            Lampa.Noty.show('📺 Знайдено ' + eps.length + ' непереглянутих серій!');
                                        } else {
                                            Lampa.Noty.show('Нових серій поки немає');
                                        }
                                    } catch(e){ log('follow fetch cb',e); }
                                });
                            }
                        } catch(e){ log('follow btn click',e); }
                    });

                    // Вставляємо кнопку із затримкою, щоб не конфліктувати
                    // з іншими плагінами (online.js, smartonline.js)
                    setTimeout(function () {
                        try {
                            var target = e.render.find(
                                '.full-start__buttons, .full-start-new__buttons, ' +
                                '.full-start__body, .full__buttons'
                            ).first();
                            if (target.length) {
                                target.append(btn);
                            } else {
                                // запасний варіант — шукаємо будь-яку кнопку і вставляємо після неї
                                e.render.find('.full-start__button, .full-start-new__button')
                                    .last().after(btn);
                            }
                        } catch(e){ log('follow btn insert',e); }
                    }, 100); // 100мс затримка — онлайн-плагін встигає відмалюватись

                } catch(e){ log('full complite',e); }
            });
        } catch(e){ log('addFollowBtn',e); }
    }

    // ============================================================
    // ВІДСТЕЖЕННЯ ПЛЕЄРА
    // ============================================================
    function addPlayerListener() {
        try {
            Lampa.Listener.follow('player', function (e) {
                try {
                    if (e.type === 'start') {
                        try {
                            var obj  = e.object || {};
                            var card = obj.movie || obj.card || {};
                            if (!card || !card.id) return;
                            var isTv = card.media_type === 'tv'
                                    || typeof card.first_air_date !== 'undefined'
                                    || typeof obj.season          !== 'undefined';
                            if (!isTv) return;
                            window._uaTracker = {
                                id:      card.id,
                                title:   card.name || card.title || '',
                                poster:  card.poster_path || '',
                                season:  parseInt(obj.season,  10) || 0,
                                episode: parseInt(obj.episode, 10) || 0,
                                voice:   obj.voice || obj.translation || obj.t || ''
                            };
                        } catch(e){ log('player start',e); }
                    }

                    if (e.type === 'end' || e.type === 'destroy') {
                        try {
                            var ctx = window._uaTracker;
                            window._uaTracker = null;
                            if (!ctx || !ctx.id || !ctx.season) return;

                            var pct = 0;
                            try {
                                var vid = document.querySelector('video');
                                if (vid && vid.duration > 0) {
                                    pct = vid.currentTime / vid.duration * 100;
                                }
                            } catch(_){}

                            if (pct >= 80 || e.type === 'end') {
                                if (!Store.getShow(ctx.id)) {
                                    Store.setShow({
                                        id: ctx.id, title: ctx.title, poster: ctx.poster,
                                        voice: ctx.voice, watched: {}, unwatched: [],
                                        last_season: 0, last_episode: 0
                                    });
                                }
                                markWatched(ctx.id, ctx.season, ctx.episode, ctx.voice);
                                log('Відмічено: ' + ctx.title + ' S' + ctx.season + 'E' + ctx.episode);
                            }
                        } catch(e){ log('player end',e); }
                    }
                } catch(e){ log('player listener',e); }
            });
        } catch(e){ log('addPlayerListener',e); }
    }

    // ============================================================
    // ЗАПУСК
    // ============================================================
    function init() {
        try {
            injectCSS();
            addMenuBtn();
            addFollowBtn();
            addPlayerListener();
            setTimeout(function(){
                try { checkAll(true); } catch(e){ log('checkAll init',e); }
            }, 8000);
            log('Плагін завантажено ✓');
        } catch(e){ log('init',e); }
    }

    // Чекаємо готовності Lampa
    if (window.Lampa && Lampa.Listener && Lampa.Storage && Lampa.Component) {
        init();
    } else {
        var _t = setInterval(function () {
            if (window.Lampa && Lampa.Listener && Lampa.Storage && Lampa.Component) {
                clearInterval(_t);
                init();
            }
        }, 300);
    }

})();
