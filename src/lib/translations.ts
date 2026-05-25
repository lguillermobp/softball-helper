export const translations = {
  en: {
    nav: {
      signin: "Sign in",
      getStarted: "Get started",
    },
    hero: {
      badge: "Multi-league softball management",
      headline1: "Step up to the",
      headline2: "plate.",
      tagline:
        "Manage your softball leagues, schedules, rosters, and standings — all from one dugout.",
      cta: "🏆 Start your league free",
      signin: "Sign in",
    },
    stats: [
      { value: "Multi-league", label: "One account" },
      { value: "RBAC", label: "Roles per league" },
      { value: "Mobile-first", label: "Field-ready" },
    ],
    features: {
      title: "Everything your league needs",
      subtitle: "Built for commissioners, managers, umpires, and players.",
      cards: [
        {
          icon: "🏆",
          title: "Multi-league RBAC",
          description:
            "One account across all your leagues. Be a commissioner in one, an umpire in another — no duplicate signups.",
          accent: "from-yellow-500/20 to-yellow-600/5",
          border: "border-yellow-500/20",
        },
        {
          icon: "📅",
          title: "Seasons & divisions",
          description:
            "Organize by season, then slice into divisions — men's, co-ed, 18U, 14U. Full bracket support coming soon.",
          accent: "from-green-500/20 to-green-600/5",
          border: "border-green-500/20",
        },
        {
          icon: "📱",
          title: "Field-ready mobile",
          description:
            "Check lineups, post scores, and track standings right from the dugout. Designed for every screen size.",
          accent: "from-blue-500/20 to-blue-600/5",
          border: "border-blue-500/20",
        },
      ],
    },
    steps: {
      title: "From signup to first pitch",
      subtitle: "Get your league running in minutes.",
      items: [
        { icon: "👤", label: "Create account" },
        { icon: "🏟️", label: "Set up league" },
        { icon: "📋", label: "Add teams" },
        { icon: "⚾", label: "Play ball!" },
      ],
    },
    cta: {
      title: "Ready to play?",
      subtitle:
        "Join league commissioners already using Softball Helper to run their seasons.",
      button: "Create your league — it's free",
    },
    footer: "Built for the love of the game.",
    login: {
      pageTitle: "Sign in to your account",
      title: "Welcome back",
      subtitle: "Enter your credentials to continue",
      email: "Email address",
      emailPlaceholder: "jane@example.com",
      password: "Password",
      signinBtn: "Sign in",
      signingIn: "Signing in...",
      noAccount: "Don't have an account?",
      createOne: "Create one",
      successMsg: "Account created! Sign in to get started.",
      invalidError: "Invalid email or password",
    },
    register: {
      pageTitle: "Create your league account",
      pageSubtitle: "You'll use this to manage all your leagues",
      steps: {
        account: {
          title: "Create your account",
          subtitle: "You'll use this to manage all your leagues",
          name: "Full name",
          namePlaceholder: "Jane Smith",
          email: "Email address",
          emailPlaceholder: "jane@example.com",
          password: "Password",
          passwordPlaceholder: "At least 8 characters",
          confirmPassword: "Confirm password",
          continue: "Continue",
          haveAccount: "Already have an account?",
          signIn: "Sign in",
        },
        league: {
          title: "Set up your league",
          subtitle: "Choose a name and plan for your league",
          name: "League name",
          namePlaceholder: "Riverside Softball League",
          city: "City",
          cityPlaceholder: "Springfield",
          state: "State",
          statePlaceholder: "IL",
          selectPlan: "Select a plan",
          back: "Back",
          continue: "Continue",
        },
        season: {
          title: "Create your first season",
          subtitle: "Seasons organize your games and standings",
          name: "Season name",
          namePlaceholder: "Summer 2025",
          startDate: "Start date",
          endDate: "End date",
          back: "Back",
          continue: "Continue",
        },
        categories: {
          title: "Add categories",
          subtitle: "Categories group teams by division, gender, or age",
          placeholder: "Category",
          addBtn: "+ Add category",
          back: "Back",
          continue: "Continue",
        },
        teams: {
          title: "Add your first teams",
          subtitle: "You can always add more teams later",
          placeholder: "Team name",
          addBtn: "+ Add team",
          back: "Back",
          finish: "Finish setup",
          finishing: "Creating league...",
        },
      },
      plans: {
        free:    { name: "Free",    description: "Up to 4 teams, 1 season" },
        starter: { name: "Starter", description: "Up to 12 teams, 3 seasons" },
        pro:     { name: "Pro",     description: "Unlimited teams and seasons" },
      },
    },
  },

  es: {
    nav: {
      signin: "Iniciar sesión",
      getStarted: "Comenzar",
    },
    hero: {
      badge: "Gestión de ligas de sóftbol",
      headline1: "Sube al",
      headline2: "plato.",
      tagline:
        "Administra tus ligas de sóftbol, calendarios, plantillas y clasificaciones — todo desde un solo dugout.",
      cta: "🏆 Crea tu liga gratis",
      signin: "Iniciar sesión",
    },
    stats: [
      { value: "Multi-liga", label: "Una cuenta" },
      { value: "Roles", label: "Por liga" },
      { value: "Móvil primero", label: "Listo para el campo" },
    ],
    features: {
      title: "Todo lo que tu liga necesita",
      subtitle: "Hecho para comisionados, managers, árbitros y jugadores.",
      cards: [
        {
          icon: "🏆",
          title: "Roles por liga",
          description:
            "Una cuenta para todas tus ligas. Sé comisionado en una y árbitro en otra — sin cuentas duplicadas.",
          accent: "from-yellow-500/20 to-yellow-600/5",
          border: "border-yellow-500/20",
        },
        {
          icon: "📅",
          title: "Temporadas y divisiones",
          description:
            "Organiza por temporada y divide en divisiones — varones, mixto, sub-18, sub-14. Soporte para brackets próximamente.",
          accent: "from-green-500/20 to-green-600/5",
          border: "border-green-500/20",
        },
        {
          icon: "📱",
          title: "Móvil listo para el campo",
          description:
            "Consulta alineaciones, anota carreras y lleva las clasificaciones desde el dugout. Para cualquier pantalla.",
          accent: "from-blue-500/20 to-blue-600/5",
          border: "border-blue-500/20",
        },
      ],
    },
    steps: {
      title: "Del registro al primer pitcheo",
      subtitle: "Pon tu liga en marcha en minutos.",
      items: [
        { icon: "👤", label: "Crear cuenta" },
        { icon: "🏟️", label: "Configurar liga" },
        { icon: "📋", label: "Agregar equipos" },
        { icon: "⚾", label: "¡A jugar!" },
      ],
    },
    cta: {
      title: "¿Listo para jugar?",
      subtitle:
        "Únete a los comisionados que ya usan Softball Helper para gestionar sus temporadas.",
      button: "Crea tu liga — es gratis",
    },
    footer: "Hecho por amor al juego.",
    login: {
      pageTitle: "Iniciar sesión en tu cuenta",
      title: "Bienvenido de vuelta",
      subtitle: "Ingresa tus credenciales para continuar",
      email: "Correo electrónico",
      emailPlaceholder: "juan@ejemplo.com",
      password: "Contraseña",
      signinBtn: "Iniciar sesión",
      signingIn: "Iniciando sesión...",
      noAccount: "¿No tienes cuenta?",
      createOne: "Crear una",
      successMsg: "¡Cuenta creada! Inicia sesión para comenzar.",
      invalidError: "Correo o contraseña incorrectos",
    },
    register: {
      pageTitle: "Crea tu cuenta de liga",
      pageSubtitle: "La usarás para gestionar todas tus ligas",
      steps: {
        account: {
          title: "Crea tu cuenta",
          subtitle: "La usarás para gestionar todas tus ligas",
          name: "Nombre completo",
          namePlaceholder: "Juan Pérez",
          email: "Correo electrónico",
          emailPlaceholder: "juan@ejemplo.com",
          password: "Contraseña",
          passwordPlaceholder: "Al menos 8 caracteres",
          confirmPassword: "Confirmar contraseña",
          continue: "Continuar",
          haveAccount: "¿Ya tienes cuenta?",
          signIn: "Iniciar sesión",
        },
        league: {
          title: "Configura tu liga",
          subtitle: "Elige un nombre y plan para tu liga",
          name: "Nombre de la liga",
          namePlaceholder: "Liga de Sóftbol Riverside",
          city: "Ciudad",
          cityPlaceholder: "Caracas",
          state: "Estado",
          statePlaceholder: "Miranda",
          selectPlan: "Selecciona un plan",
          back: "Atrás",
          continue: "Continuar",
        },
        season: {
          title: "Crea tu primera temporada",
          subtitle: "Las temporadas organizan tus juegos y clasificaciones",
          name: "Nombre de la temporada",
          namePlaceholder: "Verano 2025",
          startDate: "Fecha de inicio",
          endDate: "Fecha de fin",
          back: "Atrás",
          continue: "Continuar",
        },
        categories: {
          title: "Agregar categorías",
          subtitle: "Las categorías agrupan equipos por división, género o edad",
          placeholder: "Categoría",
          addBtn: "+ Agregar categoría",
          back: "Atrás",
          continue: "Continuar",
        },
        teams: {
          title: "Agrega tus primeros equipos",
          subtitle: "Siempre puedes agregar más equipos después",
          placeholder: "Nombre del equipo",
          addBtn: "+ Agregar equipo",
          back: "Atrás",
          finish: "Finalizar configuración",
          finishing: "Creando liga...",
        },
      },
      plans: {
        free:    { name: "Gratis",    description: "Hasta 4 equipos, 1 temporada" },
        starter: { name: "Inicial",   description: "Hasta 12 equipos, 3 temporadas" },
        pro:     { name: "Pro",       description: "Equipos y temporadas ilimitados" },
      },
    },
  },

  ja: {
    nav: {
      signin: "サインイン",
      getStarted: "始める",
    },
    hero: {
      badge: "マルチリーグ ソフトボール管理",
      headline1: "打席に",
      headline2: "立とう。",
      tagline:
        "ソフトボールリーグのスケジュール、名簿、順位表をひとつのダグアウトから管理。",
      cta: "🏆 リーグを無料で作成",
      signin: "サインイン",
    },
    stats: [
      { value: "マルチリーグ", label: "1アカウント" },
      { value: "役割管理", label: "リーグごとの役割" },
      { value: "モバイル優先", label: "フィールド対応" },
    ],
    features: {
      title: "リーグに必要なすべて",
      subtitle: "コミッショナー、監督、審判、選手のために。",
      cards: [
        {
          icon: "🏆",
          title: "マルチリーグ権限",
          description:
            "すべてのリーグで1つのアカウント。あるリーグではコミッショナー、別では審判 — 重複登録なし。",
          accent: "from-yellow-500/20 to-yellow-600/5",
          border: "border-yellow-500/20",
        },
        {
          icon: "📅",
          title: "シーズンと部門",
          description:
            "シーズンで整理し、部門に分割。男子・混合・18U・14U。ブラケット対応も近日公開。",
          accent: "from-green-500/20 to-green-600/5",
          border: "border-green-500/20",
        },
        {
          icon: "📱",
          title: "フィールド対応モバイル",
          description:
            "ベンチからラインナップ確認、スコア入力、順位確認。あらゆる画面サイズに対応。",
          accent: "from-blue-500/20 to-blue-600/5",
          border: "border-blue-500/20",
        },
      ],
    },
    steps: {
      title: "登録から初球まで",
      subtitle: "数分でリーグを開始できます。",
      items: [
        { icon: "👤", label: "アカウント作成" },
        { icon: "🏟️", label: "リーグ設定" },
        { icon: "📋", label: "チーム追加" },
        { icon: "⚾", label: "プレイボール！" },
      ],
    },
    cta: {
      title: "プレイする準備はできた？",
      subtitle:
        "Softball Helperでシーズンを運営しているコミッショナーに加わりましょう。",
      button: "リーグを作成 — 無料",
    },
    footer: "野球への愛から生まれた。",
    login: {
      pageTitle: "アカウントにサインイン",
      title: "おかえりなさい",
      subtitle: "認証情報を入力して続けてください",
      email: "メールアドレス",
      emailPlaceholder: "jane@example.com",
      password: "パスワード",
      signinBtn: "サインイン",
      signingIn: "サインイン中...",
      noAccount: "アカウントをお持ちでないですか？",
      createOne: "作成する",
      successMsg: "アカウントが作成されました！サインインしてください。",
      invalidError: "メールアドレスまたはパスワードが正しくありません",
    },
    register: {
      pageTitle: "リーグアカウントを作成",
      pageSubtitle: "すべてのリーグを管理するために使用します",
      steps: {
        account: {
          title: "アカウントを作成",
          subtitle: "すべてのリーグを管理するために使用します",
          name: "フルネーム",
          namePlaceholder: "田中 太郎",
          email: "メールアドレス",
          emailPlaceholder: "taro@example.com",
          password: "パスワード",
          passwordPlaceholder: "8文字以上",
          confirmPassword: "パスワードを確認",
          continue: "続ける",
          haveAccount: "すでにアカウントをお持ちですか？",
          signIn: "サインイン",
        },
        league: {
          title: "リーグを設定",
          subtitle: "リーグの名前とプランを選択してください",
          name: "リーグ名",
          namePlaceholder: "〇〇ソフトボールリーグ",
          city: "市区町村",
          cityPlaceholder: "東京",
          state: "都道府県",
          statePlaceholder: "東京都",
          selectPlan: "プランを選択",
          back: "戻る",
          continue: "続ける",
        },
        season: {
          title: "最初のシーズンを作成",
          subtitle: "シーズンで試合と順位表を整理します",
          name: "シーズン名",
          namePlaceholder: "2025年夏季",
          startDate: "開始日",
          endDate: "終了日",
          back: "戻る",
          continue: "続ける",
        },
        categories: {
          title: "カテゴリを追加",
          subtitle: "カテゴリで部門・性別・年齢を分類します",
          placeholder: "カテゴリ",
          addBtn: "+ カテゴリを追加",
          back: "戻る",
          continue: "続ける",
        },
        teams: {
          title: "最初のチームを追加",
          subtitle: "後でいつでも追加できます",
          placeholder: "チーム名",
          addBtn: "+ チームを追加",
          back: "戻る",
          finish: "設定を完了",
          finishing: "リーグを作成中...",
        },
      },
      plans: {
        free:    { name: "無料", description: "最大4チーム、1シーズン" },
        starter: { name: "スターター", description: "最大12チーム、3シーズン" },
        pro:     { name: "プロ", description: "無制限のチームとシーズン" },
      },
    },
  },
};

export type Locale = keyof typeof translations;

export interface LoginT {
  pageTitle: string; title: string; subtitle: string;
  email: string; emailPlaceholder: string;
  password: string; signinBtn: string; signingIn: string;
  noAccount: string; createOne: string;
  successMsg: string; invalidError: string;
}
export interface RegisterT {
  pageTitle: string; pageSubtitle: string;
  steps: {
    account:    { title: string; subtitle: string; name: string; namePlaceholder: string; email: string; emailPlaceholder: string; password: string; passwordPlaceholder: string; confirmPassword: string; continue: string; haveAccount: string; signIn: string };
    league:     { title: string; subtitle: string; name: string; namePlaceholder: string; city: string; cityPlaceholder: string; state: string; statePlaceholder: string; selectPlan: string; back: string; continue: string };
    season:     { title: string; subtitle: string; name: string; namePlaceholder: string; startDate: string; endDate: string; back: string; continue: string };
    categories: { title: string; subtitle: string; placeholder: string; addBtn: string; back: string; continue: string };
    teams:      { title: string; subtitle: string; placeholder: string; addBtn: string; back: string; finish: string; finishing: string };
  };
  plans: {
    free:    { name: string; description: string };
    starter: { name: string; description: string };
    pro:     { name: string; description: string };
  };
}

export interface T {
  nav:      { signin: string; getStarted: string };
  hero:     { badge: string; headline1: string; headline2: string; tagline: string; cta: string; signin: string };
  stats:    { value: string; label: string }[];
  features: { title: string; subtitle: string; cards: { icon: string; title: string; description: string; accent: string; border: string }[] };
  steps:    { title: string; subtitle: string; items: { icon: string; label: string }[] };
  login:    LoginT;
  register: RegisterT;
  cta:      { title: string; subtitle: string; button: string };
  footer:   string;
}
