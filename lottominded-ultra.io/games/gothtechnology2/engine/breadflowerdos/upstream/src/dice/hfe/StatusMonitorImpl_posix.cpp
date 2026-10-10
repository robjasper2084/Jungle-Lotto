#include "StatusMonitorImpl_posix.hpp"

using namespace dice::hfe;

StatusMonitorImpl_posix::StatusMonitorImpl_posix() :
	m_unknown08{0},
	m_unknown0C{0},
	m_unknown10(-1000.0),
	m_scrWindow(nullptr)
{
}

dice::hfe::StatusMonitorImpl_posix::~StatusMonitorImpl_posix()
{
}

void dice::hfe::StatusMonitorImpl_posix::shouldUpdate([[maybe_unused]] bool p_ShouldUpdate)
{
}

void dice::hfe::StatusMonitorImpl_posix::clearScreen()
{
}

void dice::hfe::StatusMonitorImpl_posix::getDimensions(int32_t*, int32_t*)
{
}

void dice::hfe::StatusMonitorImpl_posix::outputString(int32_t, int32_t, std::string&)
{
}

void dice::hfe::StatusMonitorImpl_posix::flushToScreen()
{
}
