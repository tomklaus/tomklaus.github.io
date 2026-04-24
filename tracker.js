(function () {
    'use strict';

    // ============================================================
    //  КОНСТАНТИ
    // ============================================================
    var STORE_KEY   = 'ua_tracker_data';   // основне сховище
    var CHECK_KEY   = 'ua_tracker_check';  // час останньої перевірки
    var PLUGIN_NAME = 'ua_tracker';
    var TMDB_API    = 'https://api.themoviedb.org/3';
    // TMDB public key (read-only, безпечно залишати у клієнтському коді)
    var TMDB_KEY    = '4ef0d7355d9ffb5151e987764708ce96';
    var CHECK_INTERVAL = 60 * 60 * 1000;   // перевіряти не частіше 1 разу на годину

    // ============================================================
    //  СХОВИЩЕ
    // ============================================================
    var Storage = {
        get: function () {
            try {
                return JSON.parse(Lampa.Storage.get(STORE_KEY, '{}'));
            } catch (e) { return {}; }
        },
        save: function (data) {
            Lampa.Storage.set(STORE_KEY, JSON.stringify(data));
        }
    };

    // Структура об'єкта серіалу у сховищі:
    // {
    //   [tmdb_id]: {
    //     id: 12345,
    //     title: "Назва",
    //     poster: "/path.jpg",
    //     voice: "Kубик в Кубі",         // улюблена озвучка
    //     watched: { "s1e1": true, ... }, // переглянуті серії
    //     unwatched: [                    // нові непереглянуті
    //       { season:2, episode:5, title:"...", air_date:"..." }
    //     ],
    //     last_season: 1,
    //     last_episode: 4,
    //     total_seasons: 3
    //   }
    // }

    // ============================================================
    //  ДОПОМІЖНІ ФУНКЦІЇ
    // ============================================================
    function epKey(season, episode) {
        return 's' + season + 'e' + episode;
    }

    function getShow(id) {
        var data = Storage.get();
        return data[id] || null;
    }

    function saveShow(show) {
        var data = Storage.get();
        data[show.id] = show;
        Storage.save(data);
    }

    function getAllShows() {
        var data = Storage.get();
        return Object.values(data);
    }

    // ============================================================
    //  TMDB: отримати список серій після вказаного епізоду
    // ============================================================
    function fetchNewEpisodes(show, callback) {
        var url = TMDB_API + '/tv/' + show.id
            + '?api_key=' + TMDB_KEY
            + '&language=uk-UA';

        Lampa.Reguest.native(url, function (data) {
            if (!data || !data.seasons) return callback([]);

            var newEps  = [];
            var today   = new Date().toISOString().split('T')[0];
            var seasons = data.seasons.filter(function (s) {
                return s.season_number > 0;
            });

            var pending = seasons.length;
            if (!pending) return callback([]);

            seasons.forEach(function (s) {
                var sUrl = TMDB_API + '/tv/' + show.id
                    + '/season/' + s.season_number
                    + '?api_key=' + TMDB_KEY
                    + '&language=uk-UA';

                Lampa.Reguest.native(sUrl, function (sData) {
                    if (sData && sData.episodes) {
                        sData.episodes.forEach(function (ep) {
                            // серія вже вийшла
                            if (!ep.air_date || ep.air_date > today) return;
                            var key = epKey(ep.season_number, ep.episode_number);
                            var isWatched = show.watched && show.watched[key];
                            // пропускаємо переглянуті
                            if (isWatched) return;
                            // перевіряємо, що серія новіша за останню переглянуту
                            var afterLastWatched =
                                ep.season_number > (show.last_season || 0) ||
                                (ep.season_number === (show.last_season || 0) &&
                                 ep.episode_number > (show.last_episode || 0));
                            if (afterLastWatched) {
                                newEps.push({
                                    season:  ep.season_number,
                                    episode: ep.episode_number,
                                    title:   ep.name || ('Серія ' + ep.episode_number),
                                    air_date: ep.air_date,
                                    key:     key
                                });
                            }
                        });
                    }
                    pending--;
                    if (pending === 0) callback(newEps);
                }, function () {
                    pending--;
                    if (pending === 0) callback(newEps);
                });
            });
        }, function () { callback([]); });
    }

    // ============================================================
    //  ПЕРЕВІРКА НОВИХ СЕРІЙ ДЛЯ ВСІХ СЕРІАЛІВ
    // ============================================================
    function checkAllShows(silent) {
        var now = Date.now();
        var lastCheck = parseInt(Lampa.Storage.get(CHECK_KEY, '0'), 10);
        if (!silent && now - lastCheck < CHECK_INTERVAL) return;
        Lampa.Storage.set(CHECK_KEY, String(now));

        var shows = getAllShows();
        if (!shows.length) return;

        var totalNew = 0;

        shows.forEach(function (show) {
            fetchNewEpisodes(show, function (newEps) {
                if (!newEps.length) return;

                // оновлюємо список непереглянутих (без дублів)
                var existing = (show.unwatched || []).map(function (e) { return e.key; });
                var added = 0;
                newEps.forEach(function (ep) {
                    if (existing.indexOf(ep.key) === -1) {
                        show.unwatched = show.unwatched || [];
                        show.unwatched.push(ep);
                        added++;
                        totalNew++;
                    }
                });

                if (added > 0) {
                    saveShow(show);
                    if (!silent) {
                        Lampa.Noty.show(
                            '📺 ' + show.title + ': ' + added +
                            ' нов' + (added === 1 ? 'а серія' : 'их серій') +
                            (show.voice ? ' [' + show.voice + ']' : '')
                        );
                    }
                }
            });
        });
    }

    // ============================================================
    //  ПЕРЕХОПЛЕННЯ ПРОГРАВАЧА
    // ============================================================
    Lampa.Listener.follow('player', function (e) {

        // ── Плеєр запустився ──────────────────────────────────
        if (e.type === 'start') {
            // Lampa передає об'єкт картки через e.object або e.data
            var card = (e.object && e.object.movie)
                    || (e.data && e.data.movie)
                    || e.object
                    || null;

            if (!card || !card.id || card.media_type === 'movie') return;

            // Зберігаємо поточний контекст відтворення
            window._ua_tracker_current = {
                id:      card.id,
                title:   card.name || card.title || 'Серіал',
                poster:  card.poster_path || '',
                season:  parseInt(e.object && e.object.season,  10) || 0,
                episode: parseInt(e.object && e.object.episode, 10) || 0,
                voice:   (e.object && e.object.voice)
                      || (e.object && e.object.translation)
                      || ''
            };
        }

        // ── Плеєр закрився або відео закінчилось ─────────────
        if (e.type === 'destroy' || e.type === 'end') {
            var ctx = window._ua_tracker_current;
            if (!ctx || !ctx.id || !ctx.season) return;

            var percent = 0;
            try {
                var player = Lampa.Player.video();
                if (player && player.duration) {
                    percent = (player.currentTime / player.duration) * 100;
                }
            } catch (err) {}

            // якщо переглянуто >85% — відмічаємо як переглянуте
            if (percent >= 85 || e.type === 'end') {
                markWatched(ctx);
            }

            window._ua_tracker_current = null;
        }

        // ── Прогрес ───────────────────────────────────────────
        if (e.type === 'timeupdate') {
            var ctx2 = window._ua_tracker_current;
            if (!ctx2) return;
            try {
                var vid = Lampa.Player.video();
                if (vid && vid.duration && (vid.currentTime / vid.duration) >= 0.85) {
                    markWatched(ctx2);
                    window._ua_tracker_current = null; // щоб не спрацювало двічі
                }
            } catch (err2) {}
        }
    });

    function markWatched(ctx) {
        var data  = Storage.get();
        var show  = data[ctx.id] || {
            id:         ctx.id,
            title:      ctx.title,
            poster:     ctx.poster,
            voice:      ctx.voice || '',
            watched:    {},
            unwatched:  [],
            last_season:  0,
            last_episode: 0
        };

        // оновлюємо озвучку якщо є нова
        if (ctx.voice) show.voice = ctx.voice;

        var key = epKey(ctx.season, ctx.episode);
        show.watched        = show.watched || {};
        show.watched[key]   = true;
        show.last_season    = ctx.season;
        show.last_episode   = ctx.episode;

        // видаляємо з непереглянутих
        show.unwatched = (show.unwatched || []).filter(function (ep) {
            return ep.key !== key;
        });

        data[ctx.id] = show;
        Storage.save(data);
    }

    // ============================================================
    //  КОМПОНЕНТ — ВКЛАДКА "ТРЕКЕР"
    // ============================================================
    function TrackerComponent(object) {
        var _this    = this;
        this.activity = object;
        this.html     = $('<div class="tracker-wrap"></div>');
        this.loading  = false;

        // ── Стилі ──────────────────────────────────────────────
        if (!document.getElementById('ua-tracker-style')) {
            var style = document.createElement('style');
            style.id  = 'ua-tracker-style';
            style.textContent = [
                '.tracker-wrap { padding: 2em; overflow-y: auto; height: 100%; }',
                '.tracker-header { font-size: 1.6em; margin-bottom: 1em; color: #fff; }',
                '.tracker-empty  { color: #aaa; font-size: 1.2em; text-align:center; margin-top:3em; }',
                '.tracker-show   { display:flex; flex-direction:column; margin-bottom:2em; }',
                '.tracker-show-title { font-size:1.2em; color:#e5a00d; margin-bottom:.4em; display:flex; align-items:center; gap:.6em; }',
                '.tracker-voice  { font-size:.85em; color:#aaa; }',
                '.tracker-ep     { display:flex; align-items:center; background:rgba(255,255,255,.06);',
                '                  border-radius:.5em; padding:.5em 1em; margin-bottom:.4em;',
                '                  cursor:pointer; transition:background .2s; outline:none; }',
                '.tracker-ep:hover, .tracker-ep.focus { background:rgba(255,255,255,.18); }',
                '.tracker-ep-info { flex:1; color:#fff; font-size:1em; }',
                '.tracker-ep-date { color:#888; font-size:.85em; margin-left:.5em; }',
                '.tracker-ep-del  { background:transparent; border:none; color:#e55; font-size:1.2em;',
                '                   cursor:pointer; padding:.2em .5em; }',
                '.tracker-btn     { display:inline-block; background:#e5a00d; color:#000; border:none;',
                '                   padding:.5em 1.5em; border-radius:.5em; cursor:pointer;',
                '                   font-size:1em; margin:.5em .5em 1.5em 0; }',
                '.tracker-btn:hover { background:#ffb829; }'
            ].join('\n');
            document.head.appendChild(style);
        }
    }

    TrackerComponent.prototype = {
        // ── Lifecycle ─────────────────────────────────────────
        create: function () { this.render(); },
        start:  function () {
            Lampa.Controller.add(PLUGIN_NAME, {
                toggle: function () {
                    Lampa.Controller.collectionSet(this.html);
                    Lampa.Controller.collectionFocus(false, this.html);
                }.bind(this),
                back: function () { Lampa.Activity.backward(); }
            });
            Lampa.Controller.toggle(PLUGIN_NAME);
        },
        pause:   function () {},
        stop:    function () {},
        destroy: function () { this.html.remove(); },
        render:  function () { return this.html; },

        // ── Відмальовка ───────────────────────────────────────
        render: function () {
            var _this = this;
            this.html.empty();

            var header = $('<div class="tracker-header">📺 Трекер серіалів</div>');
            this.html.append(header);

            // Кнопка "Перевірити нові серії"
            var refreshBtn = $('<button class="tracker-btn">🔄 Перевірити нові серії</button>');
            refreshBtn.on('click', function () {
                Lampa.Noty.show('Перевіряю нові серії…');
                checkAllShows(true);
                setTimeout(function () { _this.render(); }, 3000);
            });
            this.html.append(refreshBtn);

            var shows = getAllShows().filter(function (s) {
                return s.unwatched && s.unwatched.length > 0;
            });

            if (!shows.length) {
                this.html.append('<div class="tracker-empty">🎉 Немає непереглянутих серій!</div>');
                return this.html;
            }

            shows.forEach(function (show) {
                var showEl = $('<div class="tracker-show"></div>');

                var titleEl = $(
                    '<div class="tracker-show-title">' +
                    (show.poster
                        ? '<img src="https://image.tmdb.org/t/p/w92' + show.poster + '" style="height:2.5em;border-radius:.3em;">'
                        : '') +
                    '<span>' + show.title + '</span>' +
                    (show.voice
                        ? '<span class="tracker-voice">🎙 ' + show.voice + '</span>'
                        : '') +
                    '</div>'
                );
                showEl.append(titleEl);

                // Кнопка "Відкрити серіал"
                var openBtn = $('<button class="tracker-btn" style="font-size:.85em;padding:.3em 1em">▶ Відкрити</button>');
                openBtn.on('click', function () {
                    Lampa.Activity.push({
                        url:        '',
                        title:      show.title,
                        component:  'full',
                        id:         show.id,
                        card:       { id: show.id, media_type: 'tv' },
                        page:       1
                    });
                });
                showEl.append(openBtn);

                // Список непереглянутих серій (сортуємо по сезону і епізоду)
                var sorted = (show.unwatched || []).slice().sort(function (a, b) {
                    return a.season !== b.season
                        ? a.season - b.season
                        : a.episode - b.episode;
                });

                sorted.forEach(function (ep) {
                    var epEl = $(
                        '<div class="tracker-ep selector" tabindex="0">' +
                        '<span class="tracker-ep-info">' +
                        'S' + String(ep.season).padStart(2,'0') +
                        'E' + String(ep.episode).padStart(2,'0') +
                        ' — ' + ep.title +
                        '<span class="tracker-ep-date">' + (ep.air_date || '') + '</span>' +
                        '</span>' +
                        '<button class="tracker-ep-del" title="Відмітити переглянутим">✓</button>' +
                        '</div>'
                    );

                    // ✓ Відмітити вручну як переглянуте
                    epEl.find('.tracker-ep-del').on('click', function (e) {
                        e.stopPropagation();
                        var s = Storage.get();
                        var sh = s[show.id];
                        if (sh) {
                            sh.watched       = sh.watched || {};
                            sh.watched[ep.key] = true;
                            sh.unwatched = sh.unwatched.filter(function (u) {
                                return u.key !== ep.key;
                            });
                            Storage.save(s);
                        }
                        epEl.remove();
                        Lampa.Noty.show('✓ Відмічено як переглянуте');
                    });

                    showEl.append(epEl);
                });

                _this.html.append(showEl);
            });

            return this.html;
        }
    };

    // ============================================================
    //  РЕЄСТРАЦІЯ КОМПОНЕНТА
    // ============================================================
    Lampa.Component.add(PLUGIN_NAME, TrackerComponent);

    // ============================================================
    //  КНОПКА В ГОЛОВНОМУ МЕНЮ
    // ============================================================
    function addMenuButton() {
        Lampa.Listener.follow('menu', function (e) {
            if (e.type !== 'build') return;

            var count = getAllShows().reduce(function (acc, s) {
                return acc + ((s.unwatched && s.unwatched.length) || 0);
            }, 0);

            var badge = count > 0
                ? ' <span style="background:#e55;color:#fff;border-radius:1em;padding:.1em .5em;font-size:.75em;">' + count + '</span>'
                : '';

            var item = $(
                '<li class="menu__item selector">' +
                '<div class="menu__ico">📺</div>' +
                '<div class="menu__text">Трекер' + badge + '</div>' +
                '</li>'
            );

            item.on('hover:enter', function () {
                Lampa.Activity.push({
                    title:     'Трекер серіалів',
                    component: PLUGIN_NAME,
                    page:      1
                });
            });

            e.render.find('.menu__list').eq(0).append(item);
        });
    }

    // ============================================================
    //  КНОПКА "СТЕЖИТИ" НА СТОРІНЦІ СЕРІАЛУ
    // ============================================================
    Lampa.Listener.follow('full', function (e) {
        if (e.type !== 'complite') return;

        var card = e.data && e.data.movie;
        if (!card || card.media_type === 'movie' || card.first_air_date === undefined) return;
        if (!card.number_of_seasons) return; // тільки серіали

        var id   = card.id;
        var data = Storage.get();

        // Кнопка "Стежити / Не стежити"
        var isTracked = !!data[id];
        var btnText   = isTracked ? '📺 Відстежується' : '+ Стежити';
        var btn       = $('<button class="full-start__button selector" style="margin-top:.5em">' + btnText + '</button>');

        btn.on('hover:enter click', function () {
            var d = Storage.get();
            if (d[id]) {
                // зупинити відстеження
                delete d[id];
                Storage.save(d);
                btn.text('+ Стежити');
                Lampa.Noty.show('Серіал видалено з відстеження');
            } else {
                // додати до відстеження
                d[id] = {
                    id:          id,
                    title:       card.name || card.title,
                    poster:      card.poster_path || '',
                    voice:       '',
                    watched:     {},
                    unwatched:   [],
                    last_season:  0,
                    last_episode: 0
                };
                Storage.save(d);
                btn.text('📺 Відстежується');
                Lampa.Noty.show('Серіал додано до відстеження!');
                // одразу перевіряємо нові серії
                fetchNewEpisodes(d[id], function (newEps) {
                    if (!newEps.length) return;
                    var s = Storage.get();
                    if (!s[id]) return;
                    s[id].unwatched = newEps;
                    Storage.save(s);
                    Lampa.Noty.show('📺 Знайдено ' + newEps.length + ' непереглянутих серій!');
                });
            }
        });

        // Додаємо кнопку під основні кнопки серіалу
        e.render.find('.full-start__buttons, .full-start-new__buttons')
            .eq(0).append(btn);
    });

    // ============================================================
    //  ЗАПУСК
    // ============================================================
    function init() {
        addMenuButton();
        // Перевіряємо нові серії через 5 сек після завантаження
        setTimeout(function () {
            checkAllShows(false);
        }, 5000);
    }

    // Чекаємо поки Lampa повністю завантажиться
    if (window.Lampa && Lampa.Listener) {
        init();
    } else {
        var _interval = setInterval(function () {
            if (window.Lampa && Lampa.Listener) {
                clearInterval(_interval);
                init();
            }
        }, 300);
    }

})();