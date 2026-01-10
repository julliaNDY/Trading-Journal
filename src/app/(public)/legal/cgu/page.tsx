import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const dynamic = 'force-dynamic';

export default async function CGUPage() {
  const t = await getTranslations('legal');
  const tCgu = await getTranslations('legal.cgu');

  const articles = [
    { key: 'article1', title: tCgu('article1.title'), content: tCgu('article1.content') },
    { key: 'article2', title: tCgu('article2.title'), content: tCgu('article2.content') },
    { key: 'article3', title: tCgu('article3.title'), content: tCgu('article3.content') },
    { key: 'article4', title: tCgu('article4.title'), content: tCgu('article4.content') },
    { key: 'article5', title: tCgu('article5.title'), content: tCgu('article5.content') },
    { key: 'article6', title: tCgu('article6.title'), content: tCgu('article6.content') },
    { key: 'article7', title: tCgu('article7.title'), content: tCgu('article7.content') },
    { key: 'article8', title: tCgu('article8.title'), content: tCgu('article8.content') },
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
        <h1 className="text-3xl font-bold mb-2">{tCgu('title')}</h1>
        <p className="text-muted-foreground">{tCgu('description')}</p>
        <p className="text-sm text-muted-foreground mt-2">
          {t('lastUpdated')}: 07/01/2026
        </p>
      </div>

      <div className="space-y-6">
        {articles.map((article) => (
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
          {tCgu('questionsText')}
        </p>
        <Button asChild>
          <Link href="/contact">{t('contactUs')}</Link>
        </Button>
      </div>
    </div>
  );
}

