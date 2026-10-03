# 🎓 Расписание ТСПК — бот

Веб-бот для просмотра расписания [Тольяттинского социально-педагогического колледжа](https://tspk.org/studentam/novoe-raspisanie-demo.html). Показывает пары для вашей группы на сегодня, завтра, любую дату или неделю целиком. Есть тёмная тема.

## Что внутри

- **Next.js 16** + TypeScript + Tailwind CSS 4 + shadcn/ui
- **Парсер**: берёт HTML-календарь с `tspk.org` → находит Google Spreadsheet дня → скачивает его как CSV → извлекает группы и пары (предмет, преподаватель, кабинет, время)
- **In-memory кэш** 5 минут — переключение вкладок мгновенное, на `tspk.org` лишней нагрузки нет
- **Многопользовательский режим**: группа сохраняется в `localStorage` браузера — каждый пользователь видит только своё
- **Тёмная тема** через `next-themes` (системная по умолчанию, переключение вручную)

## Возможности

- 4 вкладки: **Сегодня** / **Завтра** / **По дате** (с календарём) / **Неделя** (7 дней списком)
- Автодополнение для выбора группы (42 группы: Д-11, ИСиП-21, НК-31, ПДО-41 и т.д.)
- Карточки пар с номером, временем, предметом, преподавателем, кабинетом
- Корректная обработка выходных («Занятий нет»)
- Мобильная адаптация

---

## 🚀 Быстрый старт (локально)

### Вариант A: через `npm` (классический)

```bash
# 1. Распакуйте архив
unzip tspk-bot.zip
cd tspk-bot

# 2. Установите зависимости (потребуется Node.js 18+)
npm install

# 3. Запустите dev-сервер
npm run dev
```

Откройте http://localhost:3000 — бот работает.

### Вариант B: через `bun` (быстрее в ~5 раз)

```bash
# 1. Установите bun (один раз):  curl -fsSL https://bun.sh/install | bash
unzip tspk-bot.zip
cd tspk-bot

# 2. Установите зависимости
bun install

# 3. Запустите dev-сервер
bun run dev
```

Откройте http://localhost:3000.

### Вариант C: через `pnpm`

```bash
unzip tspk-bot.zip
cd tspk-bot
pnpm install
pnpm dev
```

---

## ☁️ Деплой на Vercel (бесплатно, 1 команда)

Vercel — это команда, которая создаёт Next.js. Деплой занимает ~2 минуты.

### Способ 1: через GitHub (рекомендуется)

1. Загрузите проект на GitHub (создайте новый репозиторий, залейте папку `tspk-bot/`):
   ```bash
   cd tspk-bot
   git init
   git add .
   git commit -m "init: TSPK bot"
   git branch -M main
   git remote add origin https://github.com/<ВАШ_ЛОГИН>/tspk-bot.git
   git push -u origin main
   ```
2. Откройте https://vercel.com/new
3. Импортируйте ваш GitHub-репозиторий
4. Нажмите **Deploy** — больше ничего настраивать не нужно (env-переменных нет)
5. Через ~2 минуты получите ссылку вида `https://tspk-bot-<hash>.vercel.app`

### Способ 2: через Vercel CLI

```bash
# 1. Установите Vercel CLI:  npm i -g vercel
cd tspk-bot

# 2. Авторизуйтесь (откроется браузер)
vercel login

# 3. Деплой (на вопрос "Link to existing project?" — No; на остальные — Enter)
vercel

# 4. Через ~2 минуты получите preview-ссылку
# Для постоянного production-домена:
vercel --prod
```

### Способ 3: перетащить архив на сайт

1. Распакуйте `tspk-bot.zip` в папку
2. Откройте https://vercel.com/new
3. Выберите **Import Project from Computer** (или просто перетащите папку на главную Vercel)
4. Нажмите **Deploy**

---

## 🌐 Альтернативный деплой

### Netlify
```bash
npm i -g netlify-cli
netlify deploy
netlify deploy --prod
```

### Railway
1. Откройте https://railway.app/new
2. Импортируйте GitHub-репозиторий
3. Railway автоматически определит Next.js и запустит билд

### Свой VPS (Docker)
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

---

## 🛠 Команды

| Команда            | Что делает                                  |
| ------------------ | ------------------------------------------- |
| `npm run dev`      | Запуск dev-сервера на http://localhost:3000 |
| `npm run build`    | Production-сборка                           |
| `npm run start`    | Запуск production-сервера (после build)     |
| `npm run lint`     | Проверка ESLint                             |

---

## 📁 Структура проекта

```
tspk-bot/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── route.ts                          # GET / → "Hello, world"
│   │   │   └── schedule/
│   │   │       ├── calendar/route.ts             # GET /api/schedule/calendar
│   │   │       ├── day/route.ts                  # GET /api/schedule/day?date=YYYY-MM-DD
│   │   │       └── groups/route.ts               # GET /api/schedule/groups?date=YYYY-MM-DD
│   │   ├── globals.css                          # Tailwind + дизайн-токены
│   │   ├── layout.tsx                           # Корневой layout + ThemeProvider
│   │   └── page.tsx                             # Главная страница с вкладками
│   ├── components/
│   │   ├── schedule/
│   │   │   ├── use-tspk.ts                       # Хуки: useLocalStorage, useDaySchedule, useWeekSchedule
│   │   │   ├── GroupSelector.tsx                # Autocomplete выбора группы
│   │   │   ├── LessonCard.tsx                   # Карточка одной пары
│   │   │   ├── ScheduleForGroup.tsx             # Список пар на день
│   │   │   └── WeekView.tsx                     # 7-дневная неделя списком
│   │   ├── theme-provider.tsx                   # Обёртка над next-themes
│   │   ├── theme-toggle.tsx                     # Кнопка ☀️/🌙
│   │   └── ui/                                  # shadcn/ui компоненты (48 файлов)
│   ├── hooks/                                   # use-mobile, use-toast
│   └── lib/
│       ├── schedule/
│       │   ├── tspk-parser.ts                   # Парсер ТСПК + Google Sheets CSV
│       │   └── cache.ts                        # In-memory TTL-кэш (5 минут)
│       └── utils.ts                             # cn() helper
├── scripts/
│   └── test-parser.ts                           # Тест парсера (bun run scripts/test-parser.ts)
├── public/                                       # logo.svg, robots.txt
├── package.json
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
├── postcss.config.mjs
├── eslint.config.mjs
├── components.json                              # shadcn/ui config
├── .gitignore
├── .env.example                                 # пустой — env-переменных нет
└── README.md
```

---

## 🔌 API

### `GET /api/schedule/calendar`
Возвращает массив всех дат календаря ТСПК с ссылками на Google Spreadsheet.

**Ответ:**
```json
{
  "ok": true,
  "entries": [
    { "date": "2026-09-01", "spreadsheetId": "1LFAta0jI8koxn7cvqsiOIZo_sn37a_qlaVS1ooPxxZU" },
    { "date": "2026-09-06", "spreadsheetId": null }
  ]
}
```

### `GET /api/schedule/day?date=2026-10-01`
Возвращает полное расписание на день.

**Query-параметры:**
- `date` (обязательный, `YYYY-MM-DD`)
- `group` (необязательный, напр. `Д-11`) — если передан, в `scheduleByGroup` будет только эта группа

**Ответ:**
```json
{
  "ok": true,
  "schedule": {
    "date": "2026-10-01",
    "header": "Расписание занятий на 01 октября (четверг) 2026-2027 уч.года",
    "dayOfWeek": "Четверг",
    "groups": ["Д-11", "Д-21", "Д-31", "Д-41", "ИСиП-21", ...],
    "scheduleByGroup": {
      "Д-11": [
        {
          "number": 1,
          "time": "9.10-9.45",
          "subject": "Классный час «Разговор о важном»",
          "teacher": "Соколова Е.В.",
          "room": "каб.310"
        }
      ]
    },
    "noLessons": false
  }
}
```

### `GET /api/schedule/groups?date=2026-10-01`
Только список групп на день (для autocomplete).

---

## ⚙️ Как работает парсер

1. **Календарь**: `GET https://tspk.org/studentam/novoe-raspisanie-demo.html` → cheerio парсит HTML, ищет все таблицы `.cal` с каптионами "Сентябрь 2026", "Октябрь 2026" и т.д. Каждая ячейка таблицы — день месяца с ссылкой. Если ссылка ведёт на `docs.google.com/spreadsheets/d/XXX/edit` — это spreadsheetId. Если на `#norasp` — занятий нет (null).

2. **Расписание дня**: `GET https://docs.google.com/spreadsheets/d/{ID}/gviz/tq?tqx=out:csv` → CSV-экспорт. В одном CSV может быть несколько подтаблиц (для разных корпусов/курсов). Каждая подтаблица начинается со строки-заголовка, где вторая колонка — слово "Время", а остальные колонки — названия групп. Дальше идут строки с парами (1, 2, 3...), где каждая колонка — это предмет + преподаватель + кабинет + время для конкретной группы.

3. **Парсинг ячейки**: регулярки извлекают:
   - Время: `\d{1,2}\.\d{2}\s*[-–]\s*\d{1,2}\.\d{2}` или `\d{1,2}\.\d{2}` (одно число)
   - Преподаватель: `[А-ЯЁ][а-яё]+ [А-ЯЁ]\.[А-ЯЁ]\.` (Фамилия И.О.)
   - Кабинет: `каб\.?\s*\d+` (или `ауд.`, `корп.`)

---

## ❓ FAQ

**— У меня не открывается http://localhost:3000**
Проверьте, что dev-сервер запущен (`npm run dev` без ошибок в консоли). Если порт занят — Next.js сам займёт 3001, ищите в консоли.

**— Бот показывает «Группа не найдена в расписании»**
Сегодня выходной (или группа реально не упоминается в CSV). Попробуйте вкладку «По дате» и выберите будний день.

**— Кэш устарел — показываются старые данные**
Подождите 5 минут (кэш истечёт), или перезапустите dev-сервер. На Vercel — пере-деплой.

**— Хочу добавить push-уведомления за 10 минут до пары / PWA / Telegram-версию**
Откройте тикет в Issues — добавлю.

---

## 📝 Лицензия

Код — публичный, делайте с ним что хотите. Источник данных — tspk.org, расписание принадлежит колледжу.

