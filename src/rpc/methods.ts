// RPC method IDs for Google NotebookLM batchexecute endpoint.
// These are the short RPC identifiers used in the f.req payload.
// Source: reverse-engineered from notebooklm.google.com network traffic.

export const RPCMethod = {
  // Notebooks
  LIST_NOTEBOOKS: "wXbhsf",
  CREATE_NOTEBOOK: "CCqFvf",
  DELETE_NOTEBOOK: "WWINqb",
  RENAME_NOTEBOOK: "s0tc2d",
  GET_NOTEBOOK: "rLM1Ne",
  NOTEBOOK_SUMMARY: "VfAZjd",

  // Sources
  LIST_SOURCES: "sPH3Cd",
  ADD_SOURCE: "izAoDd",
  ADD_SOURCE_FILE: "o4cbdc",
  CHECK_SOURCE_FRESHNESS: "yR9Yof",
  // Backward-compatible aliases (all use unified ADD_SOURCE contract)
  ADD_SOURCE_URL: "izAoDd",
  ADD_SOURCE_TEXT: "izAoDd",
  ADD_SOURCE_DRIVE: "izAoDd",
  ADD_SOURCE_RESEARCH: "WbBmHd",
  GET_SOURCE: "hizoJc",
  DELETE_SOURCE: "tGMBJ",
  REFRESH_SOURCE: "FLmJqe",
  SOURCE_FULLTEXT: "gGdLid",
  SOURCE_GUIDE: "tr032e",
  RENAME_SOURCE: "b7Wfje",
  WAIT_SOURCE: "sPH3Cd",

  // Chat
  ASK: "aQ1Oc",
  GET_LAST_CONVERSATION_ID: "hPTbtc",
  GET_CONVERSATION_TURNS: "khqZz",
  // Backward-compatible aliases
  CHAT_HISTORY: "khqZz",
  CONFIGURE_CHAT: "s0tc2d",

  // Artifacts
  LIST_ARTIFACTS: "gArtLc",
  GET_ARTIFACT: "cFnqAc",
  CREATE_ARTIFACT: "R7cb6c",
  RENAME_ARTIFACT: "rc3d8d",
  DELETE_ARTIFACT: "V5N4be",
  EXPORT_ARTIFACT: "Krh3pd",
  GET_SUGGESTED_REPORTS: "ciyUvf",
  GET_INTERACTIVE_HTML: "v9rmvd",
  POLL_ARTIFACT_TASK: "EIfNad",
  ARTIFACT_SUGGESTIONS: "ciyUvf",

  // Generate
  GENERATE_AUDIO: "R7cb6c",
  GENERATE_VIDEO: "R7cb6c",
  GENERATE_SLIDE_DECK: "R7cb6c",
  REVISE_SLIDE: "KmcKPe",
  GENERATE_QUIZ: "R7cb6c",
  GENERATE_FLASHCARDS: "R7cb6c",
  GENERATE_INFOGRAPHIC: "R7cb6c",
  GENERATE_DATA_TABLE: "R7cb6c",
  GENERATE_MIND_MAP: "yyryJe",
  GENERATE_REPORT: "R7cb6c",

  // Download
  DOWNLOAD_ARTIFACT: "OvbQtd",

  // Notes
  LIST_NOTES: "cFji9",
  CREATE_NOTE: "CYK0Xb",
  UPDATE_NOTE: "cYAfTb",
  GET_NOTE: "xmNgXe",
  RENAME_NOTE: "TbnnKb",
  DELETE_NOTE: "AH0mwd",
  SAVE_NOTE: "Q8zvOc",

  // Research
  START_FAST_RESEARCH: "Ljjv0c",
  START_DEEP_RESEARCH: "QA9ei",
  POLL_RESEARCH: "e3bVqc",
  IMPORT_RESEARCH: "LBwxtb",
  // Backward-compatible aliases
  RESEARCH_STATUS: "e3bVqc",
  RESEARCH_WAIT: "e3bVqc",

  // Share
  SHARE_STATUS: "JFMDGd",
  SHARE_NOTEBOOK: "QDyure",
  // Backward-compatible aliases
  SHARE_PUBLIC: "QDyure",
  SHARE_VIEW_LEVEL: "s0tc2d",
  SHARE_ADD: "QDyure",
  SHARE_UPDATE: "QDyure",
  SHARE_REMOVE: "QDyure",

  // Language / Settings
  LIST_LANGUAGES: "VcBmXe",
  GET_LANGUAGE: "ZwVcOc",
  SET_LANGUAGE: "hT54vc",

  // Skills (NotebookLM Plus features)
  SKILL_LIST: "SkillList",
  SKILL_INSTALL: "SkillInstall",
  SKILL_UNINSTALL: "SkillUninstall",
  SKILL_STATUS: "SkillStatus",
} as const;

export type RPCMethodValue = (typeof RPCMethod)[keyof typeof RPCMethod];
