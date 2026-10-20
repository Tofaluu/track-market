// App entry point: mount the root Preact component.
import { render } from "preact";
import { App } from "./App";
import "@fontsource/ibm-plex-sans/latin-400.css";
import "@fontsource/ibm-plex-sans/latin-500.css";
import "@fontsource/ibm-plex-sans/latin-600.css";
import "@fontsource/ibm-plex-sans/latin-700.css";
import "./styles.css";

render(<App />, document.querySelector("div#app") as HTMLElement);
