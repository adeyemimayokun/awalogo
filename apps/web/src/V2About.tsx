import { ArrowUpRight } from "./icons";
import { useV2Language } from "./V2Language";

const github = "https://github.com/adeyemimayokun/awalogo";

export default function V2About() {
  const { t, language } = useV2Language();
  return <article className="v2-about-story" aria-labelledby="about-title">
    <header><p className="v2-eyebrow">{t("About awalogo")}</p><h1 id="about-title">awalogo</h1><p className="v2-about-intro">{t("Nigerian and African company logos, plus country flags, for designers and developers.")}</p>
    </header>
    {language !== "en" ? <p className="v2-about-language">{t("Editorial updates are currently available in English.")}</p> : null}
    <div lang="en">
      <p className="v2-about-credit">Created by <a href="https://www.linkedin.com/in/adeyemimayokun/" target="_blank" rel="noreferrer">Adeyemi Mayokun<ArrowUpRight size={13} /></a></p>
      <section><h2>Our logo. Our story.</h2><p>The name awalogo comes from a familiar Nigerian expression meaning “our logo.” It captures the idea behind this project: a shared resource, built around the brands we work with and the people who bring them into everyday products.</p></section>
      <section><h2>Why we built it</h2><p>The idea began while building digital products at <a href="https://sycamore.ng" target="_blank" rel="noreferrer">Sycamore<ArrowUpRight size={13} /></a>. Designers needed logos for interfaces and presentations. Developers needed dependable files they could use without downloading the same artwork over and over.</p><p>Finding an image was easy. Finding the right version, in a useful format, with a source you could check was less straightforward. Existing libraries often had gaps in their coverage of Nigerian brands. awalogo started there.</p></section>
      <section><h2>From finance to a wider collection</h2><p>The first collection focused on Nigeria’s financial ecosystem: banks, fintechs, payment providers and other financial institutions. V2 expands that foundation to Nigerian companies across industries, brands operating across African markets, and country flags.</p><p>V2 is a Coming soon preview. V1 and the current Figma plugin keep their existing catalogs. The preview is a growing collection, not a complete company registry.</p></section>
      <section><h2>Care goes into the collection</h2><p>Artwork is sourced from official websites and brand materials where available. Manually reviewed community artwork is identified separately, never presented as officially verified.</p><p>We preserve useful formats and previous identities where they are available. Raster artwork stays raster: it is not automatically traced and passed off as an original vector. Sources stay attached so you can check an asset before using it.</p></section>
      <section><h2>Built together</h2><p>awalogo is open source. Missing brands, outdated artwork and better sources are all opportunities to improve the collection together.</p><p>The code and supporting tools are open to contributions. Logos remain trademarks of their respective owners; inclusion does not imply endorsement or grant ownership. Flag artwork carries its own MIT license.</p><div className="v2-about-links"><a href={github} target="_blank" rel="noreferrer">Explore the project on GitHub<ArrowUpRight size={14} /></a><a href={`${github}/blob/main/CONTRIBUTING.md`} target="_blank" rel="noreferrer">Contribute to the collection<ArrowUpRight size={14} /></a></div></section>
    </div>
  </article>;
}
