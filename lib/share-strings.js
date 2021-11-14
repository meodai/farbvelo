export default (provider, url, text) => {
  const localText = encodeURIComponent(text);
  const localUrl = encodeURIComponent(url);

  const links = {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}&quote=${text}`,
    twitter: `https://twitter.com/intent/tweet?url=${url}&text=${text}`,
    telegram: `https://t.me/share/url?url=${url}&text=${text}`,
    pocket: `https://getpocket.com/edit?url=${url}&title=${text}`,
    reddit: `https://reddit.com/submit?url=${url}&title=${text}`,
    evernote: `https://www.evernote.com/clip.action?url=${url}&t=${text}`,
    linkedin: `https://www.linkedin.com/shareArticle?mini=true&url=${url}&title=${text}&source=${url}`,
    pinterest: `https://pinterest.com/pin/create/button/?url=${url}&media=${url}&description=${text}`,
    whatsapp: `https://wa.me/?text=${url}%20${text}`,
    email: `mailto:?subject=${url}&body=${text}`,
  };

  return links[provider];
};
