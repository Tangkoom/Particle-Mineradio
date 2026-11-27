//! 与业务无关的小工具。

use std::time::{SystemTime, UNIX_EPOCH};

/// 当前时间（毫秒时间戳），用于托盘面板的失焦防抖。
pub(crate) fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}
