import { githubApi } from './github.js'
import { demoApi } from './demo.js'

// Open the app with ?demo to try it with sample data (nothing is saved).
export const DEMO = new URLSearchParams(window.location.search).has('demo')
export const api = DEMO ? demoApi() : githubApi()
