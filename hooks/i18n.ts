// Every text the arcade shows, per language, and how the language is chosen.
//
// To add a language: copy the `en` block and translate it; add the code to
// LOCALES, to `Locale` in types/index.d.ts, its names to ALIASES, and to the
// `language` options in .claude-plugin/plugin.json. A key a language lacks
// falls back to English.

import type { Locale } from '../types'

export type { Locale }

export const LOCALES: readonly Locale[] = ['en', 'de', 'fr', 'es', 'pt', 'it', 'ja', 'zh', 'ko', 'ru']

const en = {
  title: 'Arcade',
  'menu.hint': '↑/↓ choose · Enter play · Esc prompt',
  'menu.best': 'Best {n}',
  'hud.score': 'Score {n}',
  'hud.level': 'Level {n}',
  'hud.lines': 'Lines {n}',
  'hud.best': 'Best {n}',
  'pause.idle': 'Starts as soon as Claude is working',
  'pause.done': 'Claude is done – your turn',
  'pause.asking': 'Claude has a question for you',
  'pause.permission': 'Claude is waiting for your approval',
  'pause.manual': 'Paused – P to continue',
  'help.paused': 'Esc: back to the prompt',
  'help.common': 'P pause · Q menu · Esc prompt',
  over: 'Game over · {n} points · Space',
  start: 'Space: start',
  continue: 'Space: continue',
  loading: 'Loading …',
  tooSmall: 'Make the pane bigger',
  'cmd.description': 'Play retro games while Claude works (pauses automatically)',
  'cmd.opened': 'Arcade open. Click into the field to play, Esc returns to the prompt.',
  'cmd.tooNarrow': 'Arcade: the terminal is too narrow.',
  unsupported: 'Arcade needs the terminal or the desktop app.',
  'breakout.name': 'Breakout',
  'breakout.blurb': 'Clear the wall',
  'breakout.help': '←/→ move · Space launch',
  'snake.name': 'Snake',
  'snake.blurb': 'Eat, grow, never bite yourself',
  'snake.help': '←↑↓→ steer',
  'blocks.name': 'Blocks',
  'blocks.blurb': 'Stack them, clear lines',
  'blocks.help': '←/→ move · ↑ turn · ↓ faster · Space drop',
}

export type TextKey = keyof typeof en
type Table = Partial<Record<TextKey, string>>

const de: Table = {
  'menu.hint': '↑/↓ wählen · Enter spielen · Esc Eingabe',
  'menu.best': 'Rekord {n}',
  'hud.score': 'Punkte {n}',
  'hud.level': 'Level {n}',
  'hud.lines': 'Reihen {n}',
  'hud.best': 'Rekord {n}',
  'pause.idle': 'Läuft, sobald Claude arbeitet',
  'pause.done': 'Claude ist fertig – du bist dran',
  'pause.asking': 'Claude hat eine Frage an dich',
  'pause.permission': 'Claude wartet auf deine Freigabe',
  'pause.manual': 'Pause – P zum Weiterspielen',
  'help.paused': 'Esc: zurück zur Eingabe',
  'help.common': 'P Pause · Q Menü · Esc Eingabe',
  over: 'Game over · {n} Punkte · Leertaste',
  start: 'Leertaste: Start',
  continue: 'Leertaste: weiter',
  loading: 'Lädt …',
  tooSmall: 'Fenster vergrößern',
  'cmd.description': 'Retro-Spiele, während Claude arbeitet (pausiert automatisch)',
  'cmd.opened': 'Arcade geöffnet. Klick ins Feld zum Spielen, Esc zurück zur Eingabe.',
  'cmd.tooNarrow': 'Arcade: das Terminal ist zu schmal.',
  unsupported: 'Arcade braucht das Terminal oder die Desktop-App.',
  'breakout.blurb': 'Räum die Mauer ab',
  'breakout.help': '←/→ bewegen · Leertaste abschießen',
  'snake.blurb': 'Fressen, wachsen, nicht beißen',
  'snake.help': '←↑↓→ lenken',
  'blocks.blurb': 'Stapeln, Reihen abräumen',
  'blocks.help': '←/→ schieben · ↑ drehen · ↓ schneller · Leertaste fallen lassen',
}

const fr: Table = {
  'menu.hint': '↑/↓ choisir · Entrée jouer · Échap saisie',
  'menu.best': 'Record {n}',
  'hud.score': 'Score {n}',
  'hud.level': 'Niveau {n}',
  'hud.lines': 'Lignes {n}',
  'hud.best': 'Record {n}',
  'pause.idle': 'Démarre dès que Claude travaille',
  'pause.done': 'Claude a terminé – à toi de jouer',
  'pause.asking': 'Claude a une question pour toi',
  'pause.permission': 'Claude attend ton autorisation',
  'pause.manual': 'Pause – P pour reprendre',
  'help.paused': 'Échap : retour à la saisie',
  'help.common': 'P pause · Q menu · Échap saisie',
  over: 'Partie terminée · {n} points · Espace',
  start: 'Espace : lancer',
  continue: 'Espace : continuer',
  loading: 'Chargement …',
  tooSmall: 'Agrandis le panneau',
  'cmd.description': 'Jeux rétro pendant que Claude travaille (pause automatique)',
  'cmd.opened': 'Arcade ouvert. Clique dans le jeu pour jouer, Échap revient à la saisie.',
  'cmd.tooNarrow': 'Arcade : le terminal est trop étroit.',
  unsupported: "Arcade nécessite le terminal ou l'application de bureau.",
  'breakout.blurb': 'Détruis le mur',
  'breakout.help': '←/→ déplacer · Espace lancer',
  'snake.blurb': 'Mange, grandis, ne te mords pas',
  'snake.help': '←↑↓→ diriger',
  'blocks.name': 'Blocs',
  'blocks.blurb': 'Empile et complète des lignes',
  'blocks.help': '←/→ déplacer · ↑ tourner · ↓ accélérer · Espace lâcher',
}

const es: Table = {
  'menu.hint': '↑/↓ elegir · Intro jugar · Esc entrada',
  'menu.best': 'Récord {n}',
  'hud.score': 'Puntos {n}',
  'hud.level': 'Nivel {n}',
  'hud.lines': 'Líneas {n}',
  'hud.best': 'Récord {n}',
  'pause.idle': 'Empieza en cuanto Claude trabaje',
  'pause.done': 'Claude ha terminado: te toca',
  'pause.asking': 'Claude tiene una pregunta para ti',
  'pause.permission': 'Claude espera tu permiso',
  'pause.manual': 'Pausa: P para seguir',
  'help.paused': 'Esc: volver a la entrada',
  'help.common': 'P pausa · Q menú · Esc entrada',
  over: 'Fin de la partida · {n} puntos · Espacio',
  start: 'Espacio: empezar',
  continue: 'Espacio: seguir',
  loading: 'Cargando …',
  tooSmall: 'Agranda el panel',
  'cmd.description': 'Juegos retro mientras Claude trabaja (se pausa solo)',
  'cmd.opened': 'Arcade abierto. Haz clic en el juego para jugar; Esc vuelve a la entrada.',
  'cmd.tooNarrow': 'Arcade: la terminal es demasiado estrecha.',
  unsupported: 'Arcade necesita la terminal o la app de escritorio.',
  'breakout.blurb': 'Derriba el muro',
  'breakout.help': '←/→ mover · Espacio lanzar',
  'snake.blurb': 'Come, crece y no te muerdas',
  'snake.help': '←↑↓→ girar',
  'blocks.name': 'Bloques',
  'blocks.blurb': 'Apila y completa líneas',
  'blocks.help': '←/→ mover · ↑ girar · ↓ acelerar · Espacio soltar',
}

const pt: Table = {
  'menu.hint': '↑/↓ escolher · Enter jogar · Esc entrada',
  'menu.best': 'Recorde {n}',
  'hud.score': 'Pontos {n}',
  'hud.level': 'Nível {n}',
  'hud.lines': 'Linhas {n}',
  'hud.best': 'Recorde {n}',
  'pause.idle': 'Começa assim que o Claude estiver trabalhando',
  'pause.done': 'O Claude terminou – sua vez',
  'pause.asking': 'O Claude tem uma pergunta para você',
  'pause.permission': 'O Claude aguarda sua autorização',
  'pause.manual': 'Pausa – P para continuar',
  'help.paused': 'Esc: voltar à entrada',
  'help.common': 'P pausa · Q menu · Esc entrada',
  over: 'Fim de jogo · {n} pontos · Espaço',
  start: 'Espaço: começar',
  continue: 'Espaço: continuar',
  loading: 'Carregando …',
  tooSmall: 'Aumente o painel',
  'cmd.description': 'Jogos retrô enquanto o Claude trabalha (pausa sozinho)',
  'cmd.opened': 'Arcade aberto. Clique no jogo para jogar; Esc volta à entrada.',
  'cmd.tooNarrow': 'Arcade: o terminal é estreito demais.',
  unsupported: 'O Arcade precisa do terminal ou do app desktop.',
  'breakout.blurb': 'Derrube o muro',
  'breakout.help': '←/→ mover · Espaço lançar',
  'snake.blurb': 'Coma, cresça e não se morda',
  'snake.help': '←↑↓→ virar',
  'blocks.name': 'Blocos',
  'blocks.blurb': 'Empilhe e complete linhas',
  'blocks.help': '←/→ mover · ↑ girar · ↓ acelerar · Espaço soltar',
}

const it: Table = {
  'menu.hint': '↑/↓ scegli · Invio gioca · Esc input',
  'menu.best': 'Record {n}',
  'hud.score': 'Punti {n}',
  'hud.level': 'Livello {n}',
  'hud.lines': 'Righe {n}',
  'hud.best': 'Record {n}',
  'pause.idle': 'Parte appena Claude lavora',
  'pause.done': 'Claude ha finito – tocca a te',
  'pause.asking': 'Claude ha una domanda per te',
  'pause.permission': 'Claude attende la tua autorizzazione',
  'pause.manual': 'Pausa – P per riprendere',
  'help.paused': "Esc: torna all'input",
  'help.common': 'P pausa · Q menu · Esc input',
  over: 'Game over · {n} punti · Spazio',
  start: 'Spazio: via',
  continue: 'Spazio: continua',
  loading: 'Caricamento …',
  tooSmall: 'Ingrandisci il pannello',
  'cmd.description': 'Giochi retrò mentre Claude lavora (pausa automatica)',
  'cmd.opened': "Arcade aperto. Clicca nel gioco per giocare, Esc torna all'input.",
  'cmd.tooNarrow': 'Arcade: il terminale è troppo stretto.',
  unsupported: "Arcade richiede il terminale o l'app desktop.",
  'breakout.blurb': 'Abbatti il muro',
  'breakout.help': '←/→ muovi · Spazio lancia',
  'snake.blurb': 'Mangia, cresci, non morderti',
  'snake.help': '←↑↓→ sterza',
  'blocks.name': 'Blocchi',
  'blocks.blurb': 'Impila e completa le righe',
  'blocks.help': '←/→ sposta · ↑ ruota · ↓ accelera · Spazio lascia cadere',
}

const ja: Table = {
  'menu.hint': '↑/↓ 選択 · Enter 開始 · Esc 入力へ',
  'menu.best': 'ベスト {n}',
  'hud.score': 'スコア {n}',
  'hud.level': 'レベル {n}',
  'hud.lines': 'ライン {n}',
  'hud.best': 'ベスト {n}',
  'pause.idle': 'Claude が作業を始めると開始します',
  'pause.done': 'Claude の作業が完了しました',
  'pause.asking': 'Claude から質問があります',
  'pause.permission': 'Claude が許可を待っています',
  'pause.manual': '一時停止中 – P で再開',
  'help.paused': 'Esc: 入力に戻る',
  'help.common': 'P 一時停止 · Q メニュー · Esc 入力へ',
  over: 'ゲームオーバー · {n} 点 · Space',
  start: 'Space: スタート',
  continue: 'Space: 続ける',
  loading: '読み込み中 …',
  tooSmall: 'パネルを大きくしてください',
  'cmd.description': 'Claude の作業中にレトロゲーム（自動で一時停止）',
  'cmd.opened': 'Arcade を開きました。ゲーム内をクリックして操作、Esc で入力に戻ります。',
  'cmd.tooNarrow': 'Arcade: ターミナルの幅が足りません。',
  unsupported: 'Arcade はターミナルかデスクトップアプリで動作します。',
  'breakout.name': 'ブロック崩し',
  'breakout.blurb': '壁を崩そう',
  'breakout.help': '←/→ 移動 · Space 発射',
  'snake.name': 'スネーク',
  'snake.blurb': '食べて伸びよう。自分をかまないで',
  'snake.help': '←↑↓→ 方向転換',
  'blocks.name': 'ブロック',
  'blocks.blurb': '積んでラインを消そう',
  'blocks.help': '←/→ 移動 · ↑ 回転 · ↓ 加速 · Space 落下',
}

const zh: Table = {
  'menu.hint': '↑/↓ 选择 · Enter 开始 · Esc 返回输入',
  'menu.best': '最高 {n}',
  'hud.score': '得分 {n}',
  'hud.level': '关卡 {n}',
  'hud.lines': '行数 {n}',
  'hud.best': '最高 {n}',
  'pause.idle': 'Claude 开始工作后自动开始',
  'pause.done': 'Claude 已完成，轮到你了',
  'pause.asking': 'Claude 有问题要问你',
  'pause.permission': 'Claude 正在等待你的授权',
  'pause.manual': '已暂停 – 按 P 继续',
  'help.paused': 'Esc：返回输入',
  'help.common': 'P 暂停 · Q 菜单 · Esc 返回输入',
  over: '游戏结束 · {n} 分 · 空格',
  start: '空格：开始',
  continue: '空格：继续',
  loading: '加载中 …',
  tooSmall: '请把面板调大',
  'cmd.description': 'Claude 工作时玩复古游戏（自动暂停）',
  'cmd.opened': 'Arcade 已打开。点击游戏区域开始玩，Esc 返回输入。',
  'cmd.tooNarrow': 'Arcade：终端太窄。',
  unsupported: 'Arcade 需要终端或桌面应用。',
  'breakout.name': '打砖块',
  'breakout.blurb': '打碎砖墙',
  'breakout.help': '←/→ 移动 · 空格 发球',
  'snake.name': '贪吃蛇',
  'snake.blurb': '吃东西变长，别咬到自己',
  'snake.help': '←↑↓→ 转向',
  'blocks.name': '方块',
  'blocks.blurb': '堆叠方块，消除整行',
  'blocks.help': '←/→ 移动 · ↑ 旋转 · ↓ 加速 · 空格 落下',
}

const ko: Table = {
  'menu.hint': '↑/↓ 선택 · Enter 시작 · Esc 입력으로',
  'menu.best': '최고 {n}',
  'hud.score': '점수 {n}',
  'hud.level': '레벨 {n}',
  'hud.lines': '줄 {n}',
  'hud.best': '최고 {n}',
  'pause.idle': 'Claude가 작업을 시작하면 시작됩니다',
  'pause.done': 'Claude가 작업을 마쳤어요. 이제 당신 차례예요',
  'pause.asking': 'Claude가 질문이 있어요',
  'pause.permission': 'Claude가 승인을 기다리고 있어요',
  'pause.manual': '일시정지 – P로 계속',
  'help.paused': 'Esc: 입력으로 돌아가기',
  'help.common': 'P 일시정지 · Q 메뉴 · Esc 입력으로',
  over: '게임 오버 · {n}점 · Space',
  start: 'Space: 시작',
  continue: 'Space: 계속',
  loading: '불러오는 중 …',
  tooSmall: '패널을 더 크게 해 주세요',
  'cmd.description': 'Claude가 작업하는 동안 레트로 게임 (자동 일시정지)',
  'cmd.opened': 'Arcade를 열었습니다. 게임 영역을 클릭해 플레이하고, Esc로 입력으로 돌아갑니다.',
  'cmd.tooNarrow': 'Arcade: 터미널 폭이 너무 좁습니다.',
  unsupported: 'Arcade는 터미널 또는 데스크톱 앱이 필요합니다.',
  'breakout.name': '벽돌깨기',
  'breakout.blurb': '벽을 부수세요',
  'breakout.help': '←/→ 이동 · Space 발사',
  'snake.name': '스네이크',
  'snake.blurb': '먹고 자라고, 자기 몸은 물지 마세요',
  'snake.help': '←↑↓→ 방향 전환',
  'blocks.name': '블록',
  'blocks.blurb': '쌓아서 줄을 지우세요',
  'blocks.help': '←/→ 이동 · ↑ 회전 · ↓ 가속 · Space 낙하',
}

const ru: Table = {
  'menu.hint': '↑/↓ выбор · Enter играть · Esc ввод',
  'menu.best': 'Рекорд {n}',
  'hud.score': 'Очки {n}',
  'hud.level': 'Уровень {n}',
  'hud.lines': 'Линии {n}',
  'hud.best': 'Рекорд {n}',
  'pause.idle': 'Запустится, как только Claude начнёт работать',
  'pause.done': 'Claude закончил – твой ход',
  'pause.asking': 'У Claude есть вопрос к тебе',
  'pause.permission': 'Claude ждёт твоего разрешения',
  'pause.manual': 'Пауза – P, чтобы продолжить',
  'help.paused': 'Esc: вернуться к вводу',
  'help.common': 'P пауза · Q меню · Esc ввод',
  over: 'Игра окончена · {n} очк. · Пробел',
  start: 'Пробел: старт',
  continue: 'Пробел: дальше',
  loading: 'Загрузка …',
  tooSmall: 'Увеличь панель',
  'cmd.description': 'Ретро-игры, пока Claude работает (пауза автоматически)',
  'cmd.opened': 'Arcade открыт. Кликни в поле, чтобы играть; Esc — вернуться к вводу.',
  'cmd.tooNarrow': 'Arcade: терминал слишком узкий.',
  unsupported: 'Arcade работает в терминале или в приложении для компьютера.',
  'breakout.name': 'Арканоид',
  'breakout.blurb': 'Разбей стену',
  'breakout.help': '←/→ двигать · Пробел запуск',
  'snake.name': 'Змейка',
  'snake.blurb': 'Ешь, расти и не кусай себя',
  'snake.help': '←↑↓→ поворот',
  'blocks.name': 'Блоки',
  'blocks.blurb': 'Складывай и убирай линии',
  'blocks.help': '←/→ двигать · ↑ вращать · ↓ быстрее · Пробел сбросить',
}

export const TEXTS: Record<Locale, Table> = { en, de, fr, es, pt, it, ja, zh, ko, ru }

/** The text for `key` in `locale`, `{name}` placeholders filled from `params`. */
export function t(locale: Locale, key: TextKey, params?: Record<string, string | number>): string {
  const raw = TEXTS[locale][key] ?? en[key]
  if (!params) return raw
  return raw.replace(/\{(\w+)\}/g, (all, name: string) => (name in params ? String(params[name]) : all))
}

// Names a person may write in Claude Code's `language` setting, which is free
// text ("german", "Deutsch", "日本語"), lower-cased.
const ALIASES: Record<Locale, readonly string[]> = {
  en: ['en', 'english', 'englisch', 'anglais', 'inglés', 'ingles', 'inglese', 'inglês'],
  de: ['de', 'german', 'deutsch', 'allemand', 'alemán', 'aleman', 'tedesco', 'alemão'],
  fr: ['fr', 'french', 'français', 'francais', 'französisch', 'francés', 'frances', 'francese', 'francês'],
  es: ['es', 'spanish', 'español', 'espanol', 'castellano', 'spanisch', 'espagnol', 'spagnolo', 'espanhol'],
  pt: ['pt', 'portuguese', 'português', 'portugues', 'portugiesisch', 'portugais', 'portoghese', 'brazilian portuguese'],
  it: ['it', 'italian', 'italiano', 'italienisch', 'italien'],
  ja: ['ja', 'jp', 'japanese', '日本語', 'japanisch', 'japonais', 'japonés', 'giapponese', 'japonês'],
  zh: ['zh', 'cn', 'chinese', '中文', '简体中文', '繁體中文', '汉语', '漢語', 'mandarin', 'chinesisch', 'chinois', 'chino', 'cinese', 'chinês'],
  ko: ['ko', 'kr', 'korean', '한국어', 'koreanisch', 'coréen', 'coreano'],
  ru: ['ru', 'russian', 'русский', 'russisch', 'russe', 'ruso', 'russo'],
}

/** The locale a free-text language name or a code like `de_DE.UTF-8` means, if any. */
export function matchLocale(value: string | undefined): Locale | undefined {
  if (!value) return undefined
  const v = value.trim().toLowerCase()
  if (!v || v === 'c' || v === 'posix' || v === 'auto') return undefined
  const code = v.split(/[_.@-]/)[0] ?? ''
  for (const loc of LOCALES) {
    if (ALIASES[loc].includes(v) || loc === code) return loc
  }
  for (const loc of LOCALES) {
    if (ALIASES[loc].some(name => name.length > 2 && v.includes(name))) return loc
  }
  return undefined
}

/**
 * The language to show: the plugin's own setting, then Claude Code's
 * `language` setting, then the system locale, then English.
 */
export function resolveLocale(sources: readonly (string | undefined)[]): Locale {
  for (const s of sources) {
    const loc = matchLocale(s)
    if (loc) return loc
  }
  return 'en'
}

/** Languages whose terminals usually draw ambiguous-width symbols two cells wide. */
export function prefersAscii(locale: Locale): boolean {
  return locale === 'ja' || locale === 'zh' || locale === 'ko'
}
