/**
 * PlatformIcon — renders a branded SVG icon for a given platform id.
 *
 * Uses `simple-icons` for the majority of platforms. For platforms removed
 * from simple-icons (trademark reasons), a small set of custom inline SVGs
 * is provided below. If a platform id is not recognised, a generic globe
 * icon is shown.
 */

import {
  siInstagram, siFacebook, siX, siThreads, siTiktok, siYoutube,
  siTwitch, siKick, siDiscord, siReddit, siSnapchat, siPinterest,
  siBluesky, siMastodon, siTumblr, siVk, siSinaweibo,
  siWhatsapp, siTelegram, siSignal, siMessenger, siLine, siWechat,
  siViber,
  siSpotify, siApplemusic, siSoundcloud, siDeezer, siTidal,
  siAudiomack, siBandcamp,
  siVimeo, siDailymotion, siRumble, siOdysee,
  siGithub, siGitlab, siBitbucket, siStackoverflow,
  siBehance, siDribbble, siFigma,
  siNetflix, siMax, siCrunchyroll,
  siSteam, siEpicgames, siPlaystation, siRiotgames, siRoblox,
  siCalendly, siNotion, siTrello, siZoom, siGooglemeet,
  siEtsy, siEbay, siShopify, siAliexpress,
  siPaypal, siStripe, siRevolut, siWise, siKofi, siBuymeacoffee,
  siPatreon,
  siLinktree, siCarrd, siMedium, siSubstack, siHashnode, siDevdotto,
  siGooglemaps, siWaze,
} from "simple-icons";

// ── simple-icons lookup ──

const SI_MAP: Record<string, { path: string; hex: string }> = {
  instagram: { path: siInstagram.path, hex: siInstagram.hex },
  facebook: { path: siFacebook.path, hex: siFacebook.hex },
  x: { path: siX.path, hex: siX.hex },
  threads: { path: siThreads.path, hex: siThreads.hex },
  tiktok: { path: siTiktok.path, hex: siTiktok.hex },
  youtube: { path: siYoutube.path, hex: siYoutube.hex },
  twitch: { path: siTwitch.path, hex: siTwitch.hex },
  kick: { path: siKick.path, hex: siKick.hex },
  discord: { path: siDiscord.path, hex: siDiscord.hex },
  reddit: { path: siReddit.path, hex: siReddit.hex },
  snapchat: { path: siSnapchat.path, hex: siSnapchat.hex },
  pinterest: { path: siPinterest.path, hex: siPinterest.hex },
  bluesky: { path: siBluesky.path, hex: siBluesky.hex },
  mastodon: { path: siMastodon.path, hex: siMastodon.hex },
  tumblr: { path: siTumblr.path, hex: siTumblr.hex },
  vk: { path: siVk.path, hex: siVk.hex },
  weibo: { path: siSinaweibo.path, hex: siSinaweibo.hex },
  whatsapp: { path: siWhatsapp.path, hex: siWhatsapp.hex },
  telegram: { path: siTelegram.path, hex: siTelegram.hex },
  signal: { path: siSignal.path, hex: siSignal.hex },
  messenger: { path: siMessenger.path, hex: siMessenger.hex },
  line: { path: siLine.path, hex: siLine.hex },
  wechat: { path: siWechat.path, hex: siWechat.hex },
  viber: { path: siViber.path, hex: siViber.hex },
  spotify: { path: siSpotify.path, hex: siSpotify.hex },
  applemusic: { path: siApplemusic.path, hex: siApplemusic.hex },
  soundcloud: { path: siSoundcloud.path, hex: siSoundcloud.hex },
  deezer: { path: siDeezer.path, hex: siDeezer.hex },
  tidal: { path: siTidal.path, hex: siTidal.hex },
  audiomack: { path: siAudiomack.path, hex: siAudiomack.hex },
  bandcamp: { path: siBandcamp.path, hex: siBandcamp.hex },
  vimeo: { path: siVimeo.path, hex: siVimeo.hex },
  dailymotion: { path: siDailymotion.path, hex: siDailymotion.hex },
  rumble: { path: siRumble.path, hex: siRumble.hex },
  odysee: { path: siOdysee.path, hex: siOdysee.hex },
  github: { path: siGithub.path, hex: siGithub.hex },
  gitlab: { path: siGitlab.path, hex: siGitlab.hex },
  bitbucket: { path: siBitbucket.path, hex: siBitbucket.hex },
  stackoverflow: { path: siStackoverflow.path, hex: siStackoverflow.hex },
  behance: { path: siBehance.path, hex: siBehance.hex },
  dribbble: { path: siDribbble.path, hex: siDribbble.hex },
  figma: { path: siFigma.path, hex: siFigma.hex },
  netflix: { path: siNetflix.path, hex: siNetflix.hex },
  max: { path: siMax.path, hex: siMax.hex },
  crunchyroll: { path: siCrunchyroll.path, hex: siCrunchyroll.hex },
  steam: { path: siSteam.path, hex: siSteam.hex },
  epicgames: { path: siEpicgames.path, hex: siEpicgames.hex },
  playstation: { path: siPlaystation.path, hex: siPlaystation.hex },
  riotgames: { path: siRiotgames.path, hex: siRiotgames.hex },
  roblox: { path: siRoblox.path, hex: siRoblox.hex },
  calendly: { path: siCalendly.path, hex: siCalendly.hex },
  notion: { path: siNotion.path, hex: siNotion.hex },
  trello: { path: siTrello.path, hex: siTrello.hex },
  zoom: { path: siZoom.path, hex: siZoom.hex },
  googlemeet: { path: siGooglemeet.path, hex: siGooglemeet.hex },
  etsy: { path: siEtsy.path, hex: siEtsy.hex },
  ebay: { path: siEbay.path, hex: siEbay.hex },
  shopify: { path: siShopify.path, hex: siShopify.hex },
  aliexpress: { path: siAliexpress.path, hex: siAliexpress.hex },
  paypal: { path: siPaypal.path, hex: siPaypal.hex },
  stripe: { path: siStripe.path, hex: siStripe.hex },
  revolut: { path: siRevolut.path, hex: siRevolut.hex },
  wise: { path: siWise.path, hex: siWise.hex },
  kofi: { path: siKofi.path, hex: siKofi.hex },
  buymeacoffee: { path: siBuymeacoffee.path, hex: siBuymeacoffee.hex },
  patreon: { path: siPatreon.path, hex: siPatreon.hex },
  linktree: { path: siLinktree.path, hex: siLinktree.hex },
  carrd: { path: siCarrd.path, hex: siCarrd.hex },
  medium: { path: siMedium.path, hex: siMedium.hex },
  substack: { path: siSubstack.path, hex: siSubstack.hex },
  hashnode: { path: siHashnode.path, hex: siHashnode.hex },
  devto: { path: siDevdotto.path, hex: siDevdotto.hex },
  googlemaps: { path: siGooglemaps.path, hex: siGooglemaps.hex },
  waze: { path: siWaze.path, hex: siWaze.hex },
};

// ── Custom SVGs for platforms removed from simple-icons ──

const CUSTOM_PATHS: Record<string, { path: string; hex: string }> = {
  linkedin: {
    path: "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z",
    hex: "0A66C2",
  },

  slack: {
    path: "M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zm10.122 2.521a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.268 0a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.528 2.528 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zm-2.523 10.122a2.528 2.528 0 0 1 2.523 2.522 2.528 2.528 0 0 1-2.523 2.522 2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zm0-1.268a2.527 2.527 0 0 1-2.52-2.523 2.527 2.527 0 0 1 2.52-2.52h6.313A2.528 2.528 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.522h-6.313z",
    hex: "4A154B",
  },
  amazon: {
    path: "M.844 16.96c1.965 1.56 4.86 3.02 7.87 3.02 3.3 0 5.3-1.56 5.3-3.59 0-1.82-1.42-2.69-3.85-3.59l-3.34-1.36C3.26 10.43 1.6 9.27 1.6 6.81c0-2.75 2.45-4.69 6.18-4.69 2.75 0 4.96.99 6.5 2.12.1.07.13.2.07.31l-.93 1.47a.24.24 0 0 1-.34.07c-1.3-.88-2.93-1.65-4.85-1.65-2.16 0-3.55 1.07-3.55 2.61 0 1.46 1.36 2.12 3.26 2.86l3.34 1.36c3.07 1.24 4.61 2.71 4.61 5.23 0 2.97-2.55 5.07-6.7 5.07-3.29 0-5.97-1.21-7.8-2.62a.24.24 0 0 1-.05-.32l.87-1.4a.24.24 0 0 1 .33-.06zm21.16 4.39s-.05.05-.1.07c-.56.27-1.43.56-2.55.56-2.18 0-3.62-1.07-3.62-3.39V8.58h-1.72a.24.24 0 0 1-.24-.24V6.88a.24.24 0 0 1 .16-.23c1.07-.36 2.74-1.13 3.06-3.41.01-.1.1-.17.2-.17h1.56a.24.24 0 0 1 .24.24v3.13h2.94a.24.24 0 0 1 .24.24v1.72a.24.24 0 0 1-.24.24h-2.96v8.95c0 1.13.56 1.56 1.48 1.56.72 0 1.26-.22 1.62-.4.06-.03.13-.03.19 0 .06.03.1.08.12.15l.5 1.45c.02.06.01.13-.03.18z",
    hex: "FF9900",
  },
  xbox: {
    path: "M4.102 21.033C6.212 22.881 8.98 24 12 24c3.02 0 5.788-1.119 7.898-2.967-2.293-1.4-5.149-2.293-7.898-2.293-2.75 0-5.605.892-7.898 2.293zM12 0C5.373 0 0 5.373 0 12c0 3.02 1.119 5.788 2.967 7.898 1.4-2.293 2.293-5.149 2.293-7.898 0-2.75-.892-5.605-2.293-7.898C6.212 1.119 8.98 0 12 0zm7.898 4.102c1.4 2.293 2.293 5.149 2.293 7.898 0 2.75-.892 5.605-2.293 7.898C21.881 17.788 24 15.02 24 12c0-3.02-1.119-5.788-2.967-7.898-.227-.087-1.234-.811-2.135-1.234z",
    hex: "107C10",
  },
  nintendo: {
    path: "M0 0v24h24V0H0zm5.404 16.07V7.93l9.192 8.14h-9.192zm13.192 0l-9.192-8.14h9.192v8.14z",
    hex: "E60012",
  },
  adobeportfolio: {
    path: "M22.07 0H1.93A1.93 1.93 0 000 1.93v20.14C0 23.137.863 24 1.93 24h20.14a1.93 1.93 0 001.93-1.93V1.93A1.93 1.93 0 0022.07 0zM5.65 18.21V5.79h2.79v12.42H5.65zm12.7 0V5.79l-5.84 12.42h-2.8L4.06 5.79h2.62l5.62 12.42h2.8z",
    hex: "000000",
  },
  primevideo: {
    path: "M11.998 0C5.373 0 0 5.373 0 12s5.373 12 11.998 12C18.627 24 24 18.627 24 12S18.627 0 11.998 0zM9.62 17.41c-2.42 0-4.38-1.96-4.38-4.38S7.2 8.65 9.62 8.65c1.09 0 2.08.4 2.84 1.06l-.94 1.06a3.35 3.35 0 00-1.9-.59c-1.48 0-2.69 1.21-2.69 2.69s1.21 2.69 2.69 2.69c.74 0 1.42-.3 1.91-.79l.94 1.06a4.37 4.37 0 01-2.85 1.58zm6.76 0c-2.42 0-4.38-1.96-4.38-4.38s1.96-4.38 4.38-4.38 4.38 1.96 4.38 4.38-1.96 4.38-4.38 4.38z",
    hex: "00A8E1",
  },
  disneyplus: {
    path: "M3.5 12c0-1.4.6-2.7 1.5-3.6L6.5 9.9C5.6 10.6 5 11.7 5 13c0 2.2 1.8 4 4 4 .6 0 1.2-.1 1.7-.4.3.7.8 1.3 1.4 1.8-.9.4-2 .7-3.1.7-3.6 0-6.5-2.9-6.5-6.5zm12 6.5c-1.3 0-2.5-.4-3.5-1.1 1.2-.4 2.2-1.2 2.9-2.3.2.1.4.1.6.1 2.2 0 4-1.8 4-4 0-1.6-1-3-2.4-3.6l.5-1.8c2.3.7 4 2.9 4 5.4 0 3.6-2.9 6.5-6.5 6.5zM12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.6 0 12 0zm-1.2 12.8c0-.9.7-1.6 1.6-1.6.3 0 .6.1.8.3l-.6 1.9c-.1.2-.2.4-.2.6 0 .4.3.7.7.7h5.1c.5 0 .9-.4.9-.9V9.4c0-.9-.7-1.6-1.6-1.6h-3.5l1.2-1.2c.2-.2.2-.5 0-.7s-.5-.2-.7 0L11.6 9c-.2.2-.2.5 0 .7l2.4 2.4c.2.2.5.2.7 0s.2-.5 0-.7l-1.2-1.2h3.5c.3 0 .5.2.5.5v3.6c0 .2-.1.3-.3.3h-5.1c-.1 0-.2-.1-.2-.2 0-.1 0-.2.1-.3l.9-2.5c-.3-.4-.8-.6-1.3-.6-1.4 0-2.5 1.1-2.5 2.5s1.1 2.5 2.5 2.5c.4 0 .8-.1 1.1-.3l.7 1c-.5.4-1.2.6-1.8.6-1.9 0-3.4-1.5-3.4-3.4z",
    hex: "0CC473",
  },
  microsoftteams: {
    path: "M23.5 7.75h-6.5v-.5c0-1.1-.9-2-2-2h-3c-1.1 0-2 .9-2 2v.5H6.5v9h17v-9zm-11.5-.5c0-.3.2-.5.5-.5h3c.3 0 .5.2.5.5v.5h-4v-.5zm-2 2h9v7h-9v-7zM3.5 9.25c-1.93 0-3.5 1.57-3.5 3.5s1.57 3.5 3.5 3.5 3.5-1.57 3.5-3.5-1.57-3.5-3.5-3.5zm0 5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z",
    hex: "6264A7",
  },
  applemaps: {
    path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z",
    hex: "000000",
  },
  skype: {
    path: "M12.069 18.874c-4.023 0-5.873-1.979-5.873-3.465 0-.747.556-1.273 1.272-1.273 1.76 0 1.388 2.527 4.601 2.527 1.685 0 2.612-.92 2.612-1.853 0-.556-.31-1.186-1.358-1.48l-3.554-.893c-2.864-.713-3.348-2.264-3.348-3.727 0-3.027 2.813-4.147 5.477-4.147 2.434 0 5.304 1.338 5.304 2.832 0 .713-.62 1.116-1.272 1.116-1.526 0-1.243-2.104-4.32-2.104-1.526 0-2.382.687-2.382 1.685 0 1.087 1.338 1.397 2.508 1.658l2.105.464c2.877.642 3.611 2.331 3.611 3.906 0 2.42-1.86 4.254-5.683 4.254M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0",
    hex: "00AFF0",
  },
  generic: {
    path: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z",
    hex: "6366F1",
  },
};

// ── Generic fallback icons (Lucide-style inline paths) ──

const GENERIC_ICONS: Record<string, string> = {
  website: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z",
  email: "M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z",
  phone: "M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 1.23 0 2.44.2 3.57.57.35.13.74.03 1.02-.24l2.2-2.2z",
  sms: "M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM9 11H7V9h2v2zm4 0h-2V9h2v2zm4 0h-2V9h2v2z",
  mbway: "M3 6h18a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V7a1 1 0 011-1zm3.5 3.5v5h1.5v-3.5H7V11h1v-1H6.5zm5 0c-1.1 0-2 .9-2 2v1c0 1.1.9 2 2 2s2-.9 2-2v-1c0-1.1-.9-2-2-2zm4 0v5h1.5v-1.5h.5l.75 1.5H19l-.75-1.5h.25c.55 0 1-.45 1-1v-1c0-.55-.45-1-1-1h-2zm-4 1c.55 0 1 .45 1 1v1c0 .55-.45 1-1 1s-1-.45-1-1v-1c0-.55.45-1 1-1zm5.5 0H18v1h-.5v-1z",
};

// ── Component ──

interface PlatformIconProps {
  platformId: string;
  /** Pixel size (width = height). Defaults to 20. */
  size?: number;
  /** Override color; defaults to brand color */
  color?: string;
  className?: string;
}

export function PlatformIcon({
  platformId,
  size = 20,
  color,
  className,
}: PlatformIconProps) {
  // 1. Try simple-icons
  const siIcon = SI_MAP[platformId];
  if (siIcon) {
    return (
      <svg
        role="img"
        viewBox="0 0 24 24"
        width={size}
        height={size}
        className={className}
        fill={`#${siIcon.hex}`}
        aria-hidden="true"
      >
        <path d={siIcon.path} />
      </svg>
    );
  }

  // 2. Try custom SVG paths
  const customIcon = CUSTOM_PATHS[platformId];
  if (customIcon) {
    return (
      <svg
        role="img"
        viewBox="0 0 24 24"
        width={size}
        height={size}
        className={className}
        fill={color ?? `#${customIcon.hex}`}
        aria-hidden="true"
      >
        <path d={customIcon.path} />
      </svg>
    );
  }

  // 3. Try generic icons (website, email, phone, sms, mbway)
  const genericIcon = GENERIC_ICONS[platformId];
  if (genericIcon) {
    return (
      <svg
        role="img"
        viewBox="0 0 24 24"
        width={size}
        height={size}
        className={className}
        fill={color ?? "currentColor"}
        aria-hidden="true"
      >
        <path d={genericIcon} />
      </svg>
    );
  }

  // 4. Fallback: generic globe icon for unknown/custom platforms
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill={color ?? "currentColor"}
      aria-hidden="true"
    >
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
    </svg>
  );
}
