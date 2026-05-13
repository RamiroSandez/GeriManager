import { createSystem, defaultConfig, defineConfig } from "@chakra-ui/react"

const config = defineConfig({
  conditions: {
    light: ":root &, .light &",
    dark: ".dark &, .dark .chakra-theme:not(.light) &",
  },
  theme: {
    semanticTokens: {
      colors: {
        "bg.page":       { value: { base: "#F0FDFA",  _dark: "#0A1512" } },
        "bg.panel":      { value: { base: "white",    _dark: "#0F1F1C" } },
        "bg.muted":      { value: { base: "{colors.gray.50}",  _dark: "#0D1917" } },
        "bg.hover":      { value: { base: "{colors.teal.50}",  _dark: "#162820" } },
        "border.subtle": { value: { base: "{colors.gray.100}", _dark: "#1E3530" } },
        "text.main":     { value: { base: "{colors.gray.900}", _dark: "{colors.gray.50}"  } },
        "text.muted":    { value: { base: "{colors.gray.500}", _dark: "{colors.gray.400}" } },
        "text.faint":    { value: { base: "{colors.gray.400}", _dark: "{colors.gray.600}" } },
      },
    },
  },
})

export const system = createSystem(defaultConfig, config)
