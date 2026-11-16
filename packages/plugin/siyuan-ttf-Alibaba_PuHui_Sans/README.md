# SiYuan Alibaba PuHui Sans plugin

The font files comes from: [Alibaba PuHui Sans(阿里巴巴普惠体)](https://www.alibabafonts.com/#/font)，original .woff format

## Notice

This plugin may not be compatible with other fonts or Emoji plugins in the bazaar, please disable other fonts or Emoji plugins when using this plugin.

> [!NOTE]
> This plugin modifies the font range: global. Modifies the variable: `--b3-font-family-default`.
> Compatible with editor font in settings, compatible with other plugins/code snippets that edit other variables.
> Changing the global font in settings will override the plugin's effect. Currently the plugin is enabled as the default global font.

> [!TIP]
> When fixing the issue in publish mode, plugin use new declaration syntax, it's not support in old version. If your version can't upgrade plugin, and have the issue that can't load font in publish mode, please modify the `publish` field in `plugin.json`, referring to the latest `plugin.json`. Notice: you should replace the `"fonts"` directory with the files in it, list every font files.

## [ChangeLog](https://github.com/emptylight370/siyuan-ttf-Alibaba_PuHui_Sans/blob/main/changelog.md)

- 2026-10-31 Support load fonts in independent settings window(3.8.7)
- 2026-09-24 Fix issue that publish service loaded error
- 2026-09-10 Adapt to SiYuan 3.8.2、3.8.3
- 2026-06-30 Adapt to SiYuan 3.7.0
- 2026-02-23 Update sponsorship link

## Acknowledgments

Template repo：[TCOTC/siyuan-ttf-HarmonyOS_Sans_SC-and-Twemoji](https://github.com/TCOTC/siyuan-ttf-HarmonyOS_Sans_SC-and-Twemoji)

Support development: [Link](https://emptylight370.github.io/sponsor)

## License

The plugin code is licensed under the [MIT License](LICENSE).
The bundled font files (Alibaba PuHuiTi, `fonts/`) are **not** covered by the
MIT license — they are copyright © Alibaba and governed by their own license
published at the [official font page](https://www.alibabafonts.com/#/font)
([license text](https://www.yuque.com/yiguang-wkqc2/puhuiti/nus9wiinq4aeiegy),
also bundled in `fonts/LICENSE-AlibabaPuHuiTi.md`).
