// RPC method IDs for Google NotebookLM batchexecute endpoint.
// These are the short RPC identifiers used in the f.req payload.
// Source: reverse-engineered from notebooklm.google.com network traffic.

export const RPCMethod = {
  // Notebooks
  LIST_NOTEBOOKS: "muqnm",
  CREATE_NOTEBOOK: "QTsXBe",
  DELETE_NOTEBOOK: "nkFkC",
  RENAME_NOTEBOOK: "Lnuk5b",
  GET_NOTEBOOK: "SRNFge",
  NOTEBOOK_SUMMARY: "nNPbhd",

  // Sources
  LIST_SOURCES: "sPH3Cd",
  ADD_SOURCE_URL: "tEz3pc",
  ADD_SOURCE_FILE: "Cy3CSb",
  ADD_SOURCE_TEXT: "VvC6Jb",
  ADD_SOURCE_DRIVE: "JBmbbe",
  ADD_SOURCE_RESEARCH: "WbBmHd",
  GET_SOURCE: "fXTi5d",
  DELETE_SOURCE: "K5TMF",
  REFRESH_SOURCE: "avd3Id",
  SOURCE_FULLTEXT: "gGdLid",
  SOURCE_GUIDE: "IHmced",
  RENAME_SOURCE: "CBSmge",
  WAIT_SOURCE: "sPH3Cd",

  // Chat
  ASK: "aQ1Oc",
  CHAT_HISTORY: "Kj3VFf",
  CONFIGURE_CHAT: "mBzgzd",

  // Artifacts
  LIST_ARTIFACTS: "FNTBAf",
  GET_ARTIFACT: "cFnqAc",
  RENAME_ARTIFACT: "SJKuTd",
  DELETE_ARTIFACT: "m6hPTc",
  EXPORT_ARTIFACT: "vELqYb",
  POLL_ARTIFACT_TASK: "EIfNad",
  ARTIFACT_SUGGESTIONS: "vBXTnd",

  // Generate
  GENERATE_AUDIO: "SL9rnb",
  GENERATE_VIDEO: "gHRuGb",
  GENERATE_SLIDE_DECK: "XdPCHb",
  REVISE_SLIDE: "HFiFbd",
  GENERATE_QUIZ: "lMTpTb",
  GENERATE_FLASHCARDS: "eD4a3b",
  GENERATE_INFOGRAPHIC: "cSbRJb",
  GENERATE_DATA_TABLE: "YkwRgb",
  GENERATE_MIND_MAP: "mHUBcc",
  GENERATE_REPORT: "j7ZQNd",

  // Download
  DOWNLOAD_ARTIFACT: "OvbQtd",

  // Notes
  LIST_NOTES: "UQsrfe",
  CREATE_NOTE: "XBdRde",
  GET_NOTE: "xmNgXe",
  RENAME_NOTE: "TbnnKb",
  DELETE_NOTE: "x4Rtmb",
  SAVE_NOTE: "Q8zvOc",

  // Research
  RESEARCH_STATUS: "GbBmHd",
  RESEARCH_WAIT: "WbBmHd",

  // Share
  SHARE_STATUS: "FbNTge",
  SHARE_PUBLIC: "EbNTge",
  SHARE_VIEW_LEVEL: "DbNTge",
  SHARE_ADD: "CbNTge",
  SHARE_UPDATE: "BbNTge",
  SHARE_REMOVE: "AbNTge",

  // Language / Settings
  LIST_LANGUAGES: "VcBmXe",
  GET_LANGUAGE: "UcBmXe",
  SET_LANGUAGE: "TcBmXe",

  // Skills (NotebookLM Plus features)
  SKILL_LIST: "SkillList",
  SKILL_INSTALL: "SkillInstall",
  SKILL_UNINSTALL: "SkillUninstall",
  SKILL_STATUS: "SkillStatus",
} as const;

export type RPCMethodValue = (typeof RPCMethod)[keyof typeof RPCMethod];
