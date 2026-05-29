export interface LocaleMessages {
  common: {
    all: string;
    copyToClipboard: string;
  };
  navigation: {
    openMainMenu: string;
  };
  theme: {
    system: string;
    light: string;
    dark: string;
    currentTheme: string;
    cycleTheme: string;
  };
  profile: {
    email: string;
    location: string;
    workAddress: string;
    click: string;
    googleMap: string;
    send: string;
    sendEmail: string;
    researchInterests: string;
    like: string;
    liked: string;
    thanks: string;
  };
  home: {
    about: string;
    news: string;
    selectedPublications: string;
    viewAll: string;
  };
  publications: {
    searchPlaceholder: string;
    filters: string;
    year: string;
    journal: string;
    jcrQuartile: string;
    impactFactor: string;
    type: string;
    noResults: string;
    abstract: string;
    bibtex: string;
    code: string;
    sort: string;
    sortByYear: string;
    sortByAuthorship: string;
    resultCount: {
      showing: string;
      of: string;
      publicationSingular: string;
      publicationPlural: string;
    };
    statCards: {
      allPublications: string;
      firstAuthor: string;
      correspondingAuthor: string;
      coAuthor: string;
      citations: string;
      hIndex: string;
    };
    authorshipFilters: {
      firstAuthor: string;
      correspondingAuthor: string;
      coAuthor: string;
    };
  };
  footer: {
    lastUpdated: string;
  };
}

const en: LocaleMessages = {
  common: {
    all: 'All',
    copyToClipboard: 'Copy to clipboard',
  },
  navigation: {
    openMainMenu: 'Open main menu',
  },
  theme: {
    system: 'System',
    light: 'Light',
    dark: 'Dark',
    currentTheme: 'Current theme',
    cycleTheme: 'Click to cycle theme',
  },
  profile: {
    email: 'Email',
    location: 'Location',
    workAddress: 'Work Address',
    click: 'Click',
    googleMap: 'Google Map',
    send: 'Send',
    sendEmail: 'Send Email',
    researchInterests: 'Research Interests',
    like: 'Like',
    liked: 'Liked',
    thanks: 'Thanks!',
  },
  home: {
    about: 'About',
    news: 'News',
    selectedPublications: 'Selected publications',
    viewAll: 'View All',
  },
  publications: {
    searchPlaceholder: 'Search publications...',
    filters: 'Filters',
    year: 'Year',
    journal: 'Journal',
    jcrQuartile: 'JCR Quartile',
    impactFactor: 'Impact Factor',
    type: 'Author',
    noResults: 'No publications found matching your criteria.',
    abstract: 'Abstract',
    bibtex: 'BibTeX',
    code: 'Code',
    sort: 'Sort',
    sortByYear: 'Year',
    sortByAuthorship: 'Author',
    resultCount: {
      showing: 'Showing',
      of: 'of',
      publicationSingular: 'publication',
      publicationPlural: 'publications',
    },
    statCards: {
      allPublications: 'Total',
      firstAuthor: 'First author',
      correspondingAuthor: 'Corr. author',
      coAuthor: 'Co-author',
      citations: 'Citations',
      hIndex: 'h-index',
    },
    authorshipFilters: {
      firstAuthor: 'First author',
      correspondingAuthor: 'Corresponding',
      coAuthor: 'Co-author',
    },
  },
  footer: {
    lastUpdated: 'Last updated',
  },
};

const zh: LocaleMessages = {
  common: {
    all: '全部',
    copyToClipboard: '复制到剪贴板',
  },
  navigation: {
    openMainMenu: '打开主菜单',
  },
  theme: {
    system: '跟随系统',
    light: '浅色',
    dark: '深色',
    currentTheme: '当前主题',
    cycleTheme: '点击切换主题',
  },
  profile: {
    email: '邮箱',
    location: '地址',
    workAddress: '办公地址',
    click: '点击',
    googleMap: '谷歌地图',
    send: '发送',
    sendEmail: '发送邮件',
    researchInterests: '研究领域',
    like: '点赞',
    liked: '已点赞',
    thanks: '感谢支持！',
  },
  home: {
    about: '关于我',
    news: '动态',
    selectedPublications: '精选论文',
    viewAll: '查看全部',
  },
  publications: {
    searchPlaceholder: '搜索论文...',
    filters: '筛选',
    year: '年份',
    journal: '期刊',
    jcrQuartile: 'JCR 分区',
    impactFactor: '影响因子',
    type: '作者',
    noResults: '没有找到符合条件的论文。',
    abstract: '摘要',
    bibtex: 'BibTeX',
    code: '代码',
    sort: '排序',
    sortByYear: '年份',
    sortByAuthorship: '作者',
    resultCount: {
      showing: '当前显示',
      of: '/',
      publicationSingular: '篇论文',
      publicationPlural: '篇论文',
    },
    statCards: {
      allPublications: '总数',
      firstAuthor: '第一作者',
      correspondingAuthor: '通讯作者',
      coAuthor: '合作者',
      citations: '引用',
      hIndex: 'h 指数',
    },
    authorshipFilters: {
      firstAuthor: '一作',
      correspondingAuthor: '通讯',
      coAuthor: '合作者',
    },
  },
  footer: {
    lastUpdated: '最近更新',
  },
};

export const messages: Record<string, LocaleMessages> = {
  en,
  zh,
};

export function getMessages(locale: string): LocaleMessages {
  return messages[locale] || en;
}
