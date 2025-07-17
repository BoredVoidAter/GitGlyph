module.exports = [
    {
        files: ["**/*.js"],
        languageOptions: {
            ecmaVersion: 2021,
            sourceType: "module",
            globals: {
                document: "readonly",
                window: "readonly",
                localStorage: "readonly",
                fetch: "readonly",
                URLSearchParams: "readonly",
                console: "readonly",
                alert: "readonly",
            },
        },
        rules: {
            "no-unused-vars": "warn",
            "no-console": "off",
            "indent": ["error", 4],
            "linebreak-style": ["error", "windows"],
            "quotes": ["error", "single"],
            "semi": ["error", "always"],
        },
    },
];