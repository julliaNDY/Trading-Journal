import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { ArrowLeft, Building, Globe, Shield, Cookie, User, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function MentionsLegalesPage() {
  const t = await getTranslations('legal');
  const tMentions = await getTranslations('legal.mentions');

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <Button variant="ghost" asChild className="mb-6">
        <Link href="/">
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('backToHome')}
        </Link>
      </Button>

      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">{tMentions('title')}</h1>
        <p className="text-muted-foreground">{tMentions('description')}</p>
        <p className="text-sm text-muted-foreground mt-2">
          {t('lastUpdated')}: 07/01/2026
        </p>
      </div>

      <div className="space-y-6">
        {/* Éditeur */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Building className="h-5 w-5 text-primary" />
              {tMentions('editor.title')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p><strong>{tMentions('editor.name')}</strong></p>
            <p className="text-muted-foreground">{tMentions('editor.status')}</p>
            <p className="text-muted-foreground">{tMentions('editor.address')}</p>
            <p className="text-muted-foreground">{tMentions('editor.email')}</p>
            <p className="text-muted-foreground">{tMentions('editor.tva')}</p>
          </CardContent>
        </Card>

        {/* Hébergement */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Globe className="h-5 w-5 text-primary" />
              {tMentions('hosting.title')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p><strong>{tMentions('hosting.name')}</strong></p>
            <p className="text-muted-foreground">{tMentions('hosting.address')}</p>
            <p className="text-muted-foreground">{tMentions('hosting.phone')}</p>
          </CardContent>
        </Card>

        {/* Directeur de publication */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              {tMentions('director.title')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground leading-relaxed">{tMentions('director.content')}</p>
          </CardContent>
        </Card>

        {/* Propriété intellectuelle */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              {tMentions('intellectual.title')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground leading-relaxed">{tMentions('intellectual.content')}</p>
          </CardContent>
        </Card>

        {/* Cookies */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Cookie className="h-5 w-5 text-primary" />
              {tMentions('cookies.title')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground leading-relaxed">{tMentions('cookies.content')}</p>
          </CardContent>
        </Card>

        {/* RGPD */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              {tMentions('gdpr.title')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground leading-relaxed">{tMentions('gdpr.content')}</p>
          </CardContent>
        </Card>

        {/* Tarification */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              {tMentions('pricing.title')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground leading-relaxed">{tMentions('pricing.content')}</p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-12 text-center">
        <p className="text-sm text-muted-foreground mb-4">
          Des questions ou une demande concernant vos données personnelles ?
        </p>
        <Button asChild>
          <Link href="/contact">Contactez-nous</Link>
        </Button>
      </div>
    </div>
  );
}

