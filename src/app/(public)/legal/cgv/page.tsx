import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const dynamic = 'force-dynamic';

export default async function CGVPage() {
  const t = await getTranslations('legal');
  const tCgv = await getTranslations('legal.cgv');

  const articles = [
    { key: 'article1', title: tCgv('article1.title'), content: tCgv('article1.content') },
    { key: 'article2', title: tCgv('article2.title'), content: tCgv('article2.content') },
    { key: 'article3', title: tCgv('article3.title'), content: tCgv('article3.content') },
    { key: 'article4', title: tCgv('article4.title'), content: tCgv('article4.content') },
    { key: 'article5', title: tCgv('article5.title'), content: tCgv('article5.content') },
    { key: 'article6', title: tCgv('article6.title'), content: tCgv('article6.content') },
    { key: 'article7', title: tCgv('article7.title'), content: tCgv('article7.content') },
    { key: 'article8', title: tCgv('article8.title'), content: tCgv('article8.content') },
  ];

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <Button variant="ghost" asChild className="mb-6">
        <Link href="/">
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('backToHome')}
        </Link>
      </Button>

      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">{tCgv('title')}</h1>
        <p className="text-muted-foreground">{tCgv('description')}</p>
        <p className="text-sm text-muted-foreground mt-2">
          {t('lastUpdated')}: 07/01/2026
        </p>
      </div>

      <div className="space-y-6">
        {articles.map((article, index) => (
          <Card key={article.key}>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">{article.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground leading-relaxed">{article.content}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-12 text-center">
        <p className="text-sm text-muted-foreground mb-4">
          {tCgv('questionsText')}
        </p>
        <Button asChild>
          <Link href="/contact">{t('contactUs')}</Link>
        </Button>
      </div>
    </div>
  );
}

