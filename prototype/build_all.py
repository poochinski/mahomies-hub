import re
base=open('/home/claude/data/app.template.html').read()
gl=open('/home/claude/data/game_light.css').read(); gn=open('/home/claude/data/game_night.css').read()
light=base.replace('</style>',gl+'</style>',1)
d=open('/home/claude/data/app.json').read().replace('</','<\\/')
open('/home/claude/mahomies-hub-test.html','w').write(light.replace('__DATA__',d))
css=open('/home/claude/data/night.css').read()+gn
s=re.sub(r'<style>.*?</style>','<style>\n'+css+'</style>',base,count=1,flags=re.S)
s=s.replace('family=Inter:wght@400;500;600;700;800;900&display=swap','family=Chakra+Petch:wght@500;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap')
s=s.replace('<meta name="theme-color" content="#2f3238">','<meta name="theme-color" content="#130f1d">')
for a,b in [("'var(--green)'","'var(--win)'"),("'var(--red)'","'var(--loss)'"),("'var(--text)'","'var(--ink)'"),
            ('<small style="color:var(--green)">2026</small>','<small style="color:var(--pink)">2026</small>'),
            ('color:var(--text-faint)','color:var(--faint)')]:
    s=s.replace(a,b)
s=s.replace('<i style="background:var(--blue)"></i><i style="background:var(--green)"></i><i style="background:var(--red)"></i><i style="background:var(--yellow)"></i>','<i style="background:var(--banana)"></i><i style="background:var(--pink)"></i><i style="background:var(--cyan)"></i><i style="background:var(--win)"></i>')
s=re.sub(r"var PAL=\[[^\]]*\];","var PAL=['#f6cf4c','#4cecff','#ff5fd6','#5dff8f','#ffb347','#b18cff','#7ef0d4','#ff8a65','#8fb3ff','#ffd6f2','#c6ff6b','#ff9fb2','#9aa3c7','#f2a7ff'];",s)
s=s.replace("<title>Mahomie's Hub</title>","<title>Mahomie's Hub Night</title>")
left=sorted(set(re.findall(r'var\(--(green|red|blue|yellow|text|text-soft|text-faint|dark|surface[-0-9]*|border[-a-z]*)\)',s)))
open('/home/claude/mahomies-hub-night.html','w').write(s.replace('__DATA__',d))
print('night leftover tokens',left)
