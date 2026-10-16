# Shared React screens

A small application example with two real React screen entries, a shared Button and Shell, Lucide icons, editable form state and button interactions. Use the source files with canvas_write_react and declare react/react-dom 19.3.0 and lucide-react 0.468.0. Bind Overview.tsx and Settings.tsx to separate 1120 × 760 frames with exportName: default. The application is local preview data; saving settings does not call a backend.

This example is independent of shadcn. A customized shadcn Button can replace src/components/Button.tsx, with its npm dependencies declared, without rewriting either screen. The exact same pattern works for other React component libraries.
