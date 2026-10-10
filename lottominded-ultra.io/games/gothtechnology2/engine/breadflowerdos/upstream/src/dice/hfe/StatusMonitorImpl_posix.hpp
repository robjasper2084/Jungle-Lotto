#pragma once
#include "StatusMonitorImpl.hpp"

namespace dice::hfe
{
	class StatusMonitorImpl_posix :
		public StatusMonitorImpl
	{
	public:
		uint8_t m_unknown08[4];
		uint8_t m_unknown0C[4];
		double m_unknown10;
		void* m_scrWindow;	  // WINDOW *initscr(void);

	public:
		StatusMonitorImpl_posix();
		virtual ~StatusMonitorImpl_posix() override;
		virtual void shouldUpdate(bool p_ShouldUpdate) override;
		virtual void clearScreen() override;
		virtual void getDimensions(int32_t*, int32_t*) override;
		virtual void outputString(int32_t, int32_t, std::string&) override;
		virtual void flushToScreen() override;
	};
#if defined(_WIN32)
#else
	static_assert(sizeof(StatusMonitorImpl_posix) == 0x20);
#endif
}	 // namespace dice::hfe
