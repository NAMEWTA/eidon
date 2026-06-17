// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod runner;

fn main() {
    // Explicit multi-thread tokio runtime kept alive for the whole process
    // lifetime. Tauri 2 brings tokio transitively but doesn't always
    // enter a multi-thread runtime at plugin-setup time on Windows;
    // any plugin or sync code that does `tokio::spawn` during setup
    // would panic, and on Windows release builds (panic = abort) that
    // panic terminates the entire app at startup.
    //
    // First seen as the v1.1.2 Windows launch crash with the (now-gone)
    // tauri-plugin-aptabase. The defensive guard stays for any plugin or
    // async setup code that relies on a multi-thread runtime being available.
    let rt = tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()
        .expect("build tokio runtime");
    let _guard = rt.enter();

    runner::run();
}
