import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { ArrowLeft, Shield, Database, Cookie, Lock, UserCheck, Globe, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const dynamic = 'force-dynamic';

export default async function PrivacyPage() {
  const t = await getTranslations('legal');
  const tPrivacy = await getTranslations('legal.privacy');

  const sections = [
    { 
      key: 'dataCollection', 
      icon: Database,
      title: tPrivacy('dataCollection.title'), 
      content: tPrivacy('dataCollection.content') 
    },
    { 
      key: 'dataUsage', 
      icon: UserCheck,
      title: tPrivacy('dataUsage.title'), 
      content: tPrivacy('dataUsage.content') 
    },
    { 
      key: 'dataStorage', 
      icon: Lock,
      title: tPrivacy('dataStorage.title'), 
      content: tPrivacy('dataStorage.content') 
    },
    { 
      key: 'cookies', 
      icon: Cookie,
      title: tPrivacy('cookies.title'), 
      content: tPrivacy('cookies.content') 
    },
    { 
      key: 'thirdParties', 
      icon: Globe,
      title: tPrivacy('thirdParties.title'), 
      content: tPrivacy('thirdParties.content') 
    },
    { 
      key: 'rights', 
      icon: Shield,
      title: tPrivacy('rights.title'), 
      content: tPrivacy('rights.content') 
    },
    { 
      key: 'contact', 
      icon: Mail,
      title: tPrivacy('contact.title'), 
      content: tPrivacy('contact.content') 
    },
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
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 rounded-full bg-primary/10">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">{tPrivacy('title')}</h1>
            <p className="text-muted-foreground">{tPrivacy('description')}</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          {t('lastUpdated')}: 09/01/2026
        </p>
      </div>

      <div className="space-y-6">
        {sections.map((section) => {
          const IconComponent = section.icon;
          return (
            <Card key={section.key}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <IconComponent className="h-5 w-5 text-primary" />
                  {section.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
                  {section.content}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="mt-12 text-center">
        <p className="text-sm text-muted-foreground mb-4">
          {tPrivacy('questionsText')}
        </p>
        <Button asChild>
          <Link href="/contact">{t('contactUs')}</Link>
        </Button>
      </div>
    </div>
  );
}
