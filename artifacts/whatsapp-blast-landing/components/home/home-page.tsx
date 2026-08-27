'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Gamepad2,
  MessageSquareText,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Ticket,
  Zap,
} from 'lucide-react';
import { useLocale } from '@/components/i18n/locale-provider';
import { MetaPartnerBanner } from '@/components/home/meta-partner-banner';
import { getLocalizedProducts } from '@/lib/i18n/products';

export function HomePage() {
  const { locale, t } = useLocale();
  const products = useMemo(() => getLocalizedProducts(locale), [locale]);
  const [faqActive, setFaqActive] = useState<number | null>(0);

  const faqs = useMemo(
    () =>
      [
        [t('home.faq1q'), t('home.faq1a')],
        [t('home.faq2q'), t('home.faq2a')],
        [t('home.faq3q'), t('home.faq3a')],
        [t('home.faq4q'), t('home.faq4a')],
      ] as const,
    [t],
  );

  return (
    <main className="ora-page">
      <section className="hero" id="top">
        <div className="hero-plane" />
        <div className="container hero-grid">
          <div className="hero-copy-block">
            <h1>
              {t('home.heroTitleBefore')}
              <em>{t('home.heroTitleEm')}</em>
            </h1>
            <p className="hero-copy">{t('home.heroCopy')}</p>
            <div className="hero-actions">
              <Link className="button-primary" href="/demo/di/orarepot?minat=ai">
                {t('common.tryNow')} <ArrowRight size={16} />
              </Link>
              <Link className="button-ghost" href="#produk">
                {t('home.seeAllProducts')}
              </Link>
            </div>
          </div>
          <div className="chat-visual" aria-hidden="true">
            <div className="chat-stage">
              <div className="chat-phone">
                <div className="chat-status">
                  <img src="/logo-orarepot-icon.png" alt="" className="chat-avatar" />
                  <div>
                    <strong>Ora Repot AI</strong>
                    <span>{t('home.chatOnline')}</span>
                  </div>
                </div>
                <div className="chat-thread">
                  <div className="bubble in">{t('home.chatIn1')}</div>
                  <div className="bubble out">
                    {t('home.chatOut1')}
                    <small>{t('home.chatOut1Small')}</small>
                  </div>
                  <div className="bubble in">{t('home.chatIn2')}</div>
                  <div className="bubble out typing">
                    <i />
                    <i />
                    <i />
                  </div>
                </div>
              </div>
              <div className="chat-glow" />
            </div>
          </div>
        </div>
      </section>

      <section className="section products-section" id="produk">
        <div className="container">
          <div className="section-intro" id="solusi">
            <span className="section-kicker">{t('home.pillarsKicker')}</span>
            <h2 className="section-heading">{t('home.pillarsHeading')}</h2>
            <p className="section-lead">{t('home.pillarsLead')}</p>
          </div>
          <div className="pillar-rail">
            {products.map((product) => {
              const Icon = product.icon;
              return (
                <article className="pillar" key={product.slug}>
                  <div className="pillar-meta">
                    <span className="pillar-icon">
                      <Icon size={20} />
                    </span>
                    <span className="pillar-label">{product.label}</span>
                  </div>
                  <h3>{product.title}</h3>
                  <p>{product.description}</p>
                  <Link className="pillar-link" href={product.href}>
                    {t('home.learnProduct', { label: product.label })}{' '}
                    <ArrowRight size={14} />
                  </Link>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="section ai-section" id="ai">
        <div className="container split-grid">
          <div>
            <span className="section-kicker">{t('home.aiKicker')}</span>
            <h2 className="section-heading">{t('home.aiHeading')}</h2>
            <p className="section-lead">{t('home.aiLead')}</p>
            <ul className="feature-lines">
              <li>
                <Sparkles size={16} /> {t('home.aiF1')}
              </li>
              <li>
                <MessageSquareText size={16} /> {t('home.aiF2')}
              </li>
              <li>
                <Zap size={16} /> {t('home.aiF3')}
              </li>
            </ul>
            <Link className="button-primary dark" href="/demo/di/orarepot?minat=ai">
              {t('common.tryNow')} <ArrowRight size={16} />
            </Link>
          </div>
          <div className="ai-panel">
            <div className="ai-panel-head">{t('home.aiPanelHead')}</div>
            <ol className="ai-steps">
              <li>
                <strong>{t('home.aiStep1Title')}</strong>
                <span>{t('home.aiStep1Body')}</span>
              </li>
              <li>
                <strong>{t('home.aiStep2Title')}</strong>
                <span>{t('home.aiStep2Body')}</span>
              </li>
              <li>
                <strong>{t('home.aiStep3Title')}</strong>
                <span>{t('home.aiStep3Body')}</span>
              </li>
              <li>
                <strong>{t('home.aiStep4Title')}</strong>
                <span>{t('home.aiStep4Body')}</span>
              </li>
            </ol>
          </div>
        </div>
      </section>

      <section className="section messaging-section" id="messaging">
        <div className="container">
          <div className="section-intro">
            <span className="section-kicker">{t('home.msgKicker')}</span>
            <h2 className="section-heading">{t('home.msgHeading')}</h2>
          </div>
          <div className="messaging-split">
            <article className="msg-block">
              <ShieldCheck size={22} />
              <h3>{t('home.msgBroadcastTitle')}</h3>
              <p>{t('home.msgBroadcastBody')}</p>
            </article>
            <article className="msg-block accent">
              <ShieldCheck size={22} />
              <h3>{t('home.msgOtpTitle')}</h3>
              <p>{t('home.msgOtpBody')}</p>
            </article>
          </div>
          <div className="section-cta">
            <Link className="button-primary dark" href="/di/orarepot/waba-messaging">
              {t('home.msgCta')} <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      <section className="section digital-section" id="digital">
        <div className="container split-grid reverse">
          <div className="digital-mosaic" aria-hidden="true">
            <div className="mosaic-item">
              <Smartphone size={22} />
              <strong>{t('home.digitalPulsa')}</strong>
              <span>{t('home.digitalPulsaSub')}</span>
            </div>
            <div className="mosaic-item lime">
              <Gamepad2 size={22} />
              <strong>{t('home.digitalGame')}</strong>
              <span>{t('home.digitalGameSub')}</span>
            </div>
            <div className="mosaic-item wide">
              <Ticket size={22} />
              <strong>{t('home.digitalOther')}</strong>
              <span>{t('home.digitalOtherSub')}</span>
            </div>
          </div>
          <div>
            <span className="section-kicker">{t('home.digitalKicker')}</span>
            <h2 className="section-heading">{t('home.digitalHeading')}</h2>
            <p className="section-lead">{t('home.digitalLead')}</p>
            <Link className="button-primary" href="/di/orarepot/pulsa-dan-voucher-game">
              {t('home.digitalCta')} <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      <section className="section faq-section" id="faq">
        <div className="container faq-layout">
          <div>
            <span className="section-kicker">{t('home.faqKicker')}</span>
            <h2 className="section-heading">{t('home.faqHeading')}</h2>
          </div>
          <div className="faq-list">
            {faqs.map(([question, answer], i) => (
              <div className="faq-item" key={question}>
                <button
                  type="button"
                  className="faq-question"
                  onClick={() => setFaqActive(faqActive === i ? null : i)}
                >
                  <span>{question}</span>
                  {faqActive === i ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>
                {faqActive === i && <div className="faq-answer">{answer}</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      <MetaPartnerBanner />

      <section className="closing">
        <div className="container closing-inner">
          <div>
            <h2>{t('home.closingTitle')}</h2>
            <p>{t('home.closingBody')}</p>
          </div>
          <Link className="button-primary" href="/demo/di/orarepot?minat=ai">
            {t('common.tryNow')} <ArrowRight size={17} />
          </Link>
        </div>
      </section>
    </main>
  );
}
