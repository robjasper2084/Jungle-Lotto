(function configureLottoMindRuntime(global) {
  "use strict";

  global.LOTTOMIND_SUPABASE_URL = "https://sqdasdbvlkgpbbiyeune.supabase.co";
  global.LOTTOMIND_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_E2zwiUAV_Ox5L7KFl_A-Sw_6IiHf4qk";
  global.LOTTOMIND_API_BASE_URL = global.LOTTOMIND_SUPABASE_URL + "/functions/v1/lottomind-api";
  global.LOTTOMIND_PROTECTED_API_BASE_URL = global.LOTTOMIND_SUPABASE_URL + "/functions/v1/lottomind-protected";
})(window);
